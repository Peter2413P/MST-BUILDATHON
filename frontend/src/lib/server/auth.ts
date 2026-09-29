import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { query, exec } from './db';

export interface SessionData {
  sessionId: string;
  walletAddress: string;
  authenticated: boolean;
  connectedNetwork: string;
  sessionCreatedAt: string;
  autoPaymentEnabled: boolean;
  sessionLimit: number;
  sessionSpent: number;
  remaining: number;
  expiresAt: number;
}

interface NonceData {
  nonce: string;
  walletAddress: string;
  expiresAt: number;
}

// In-memory session cache for low-latency lookups
const sessions = new Map<string, SessionData>();
const nonces = new Map<string, NonceData>();

const NONCE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function generateNonce(rawAddress: string): Promise<string> {
  const cleanAddress = ethers.getAddress(rawAddress.toLowerCase());
  const nonce = `AgentMesh-Auth-${uuidv4()}`;
  const expiresAt = Date.now() + NONCE_TTL_MS;

  nonces.set(cleanAddress, {
    nonce,
    walletAddress: cleanAddress,
    expiresAt,
  });

  try {
    await exec(
      'INSERT OR REPLACE INTO auth_nonces (wallet_address, nonce, expires_at) VALUES (?, ?, ?)',
      [cleanAddress, nonce, expiresAt]
    );
  } catch (err) {
    console.warn('[Auth DB] Failed to persist nonce to database:', (err as Error).message);
  }

  console.log(`[Auth] Wallet connected: ${cleanAddress}`);
  console.log(`[Auth] Nonce generated: ${nonce}`);
  return nonce;
}

export function getExpectedSignMessage(nonce: string): string {
  return `Sign this message to authenticate. No MSTC will be transferred.\n\nNonce: ${nonce}\nDomain: AgentMesh\nNetwork: MST Testnet`;
}

export async function verifySignature(rawAddress: string, signature: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanAddress = ethers.getAddress(rawAddress.toLowerCase());
    let stored = nonces.get(cleanAddress);

    // If not in-memory (e.g. Next.js multi-worker), check SQLite database
    if (!stored || Date.now() > stored.expiresAt) {
      try {
        const rows = (await query('SELECT nonce, expires_at FROM auth_nonces WHERE wallet_address = ?', [
          cleanAddress,
        ])) as unknown as { nonce: string; expires_at: number }[];

        if (rows && rows.length > 0 && Date.now() <= rows[0].expires_at) {
          stored = {
            nonce: rows[0].nonce,
            walletAddress: cleanAddress,
            expiresAt: rows[0].expires_at,
          };
          nonces.set(cleanAddress, stored);
        }
      } catch (dbErr) {
        console.warn('[Auth DB] Nonce query fallback failed:', dbErr);
      }
    }

    if (!stored || Date.now() > stored.expiresAt) {
      return { success: false, error: 'Authentication nonce expired. Please request a new nonce.' };
    }

    const expectedMessage = getExpectedSignMessage(stored.nonce);
    const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);

    if (ethers.getAddress(recoveredAddress.toLowerCase()) !== cleanAddress) {
      return { success: false, error: 'Invalid signature for wallet address' };
    }

    // Single-use nonce cleanup
    nonces.delete(cleanAddress);
    try {
      await exec('DELETE FROM auth_nonces WHERE wallet_address = ?', [cleanAddress]);
    } catch {
      /* non-critical */
    }

    console.log(`[Auth] Signature verified for: ${cleanAddress}`);
    return { success: true };
  } catch (err) {
    console.error('[Auth] Signature verification error:', err);
    return { success: false, error: 'Cryptographic signature verification failed' };
  }
}

export async function createSession(rawAddress: string): Promise<SessionData> {
  const cleanAddress = ethers.getAddress(rawAddress.toLowerCase());

  // Invalidate any previous session for this address
  for (const [sId, s] of sessions.entries()) {
    if (s.walletAddress.toLowerCase() === cleanAddress.toLowerCase()) {
      sessions.delete(sId);
    }
  }

  const sessionId = `sess_${uuidv4().replace(/-/g, '')}`;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const session: SessionData = {
    sessionId,
    walletAddress: cleanAddress,
    authenticated: true,
    connectedNetwork: 'MST Testnet',
    sessionCreatedAt: new Date().toISOString(),
    autoPaymentEnabled: true,
    sessionLimit: 1000000.0,
    sessionSpent: 0,
    remaining: 1000000.0,
    expiresAt,
  };

  sessions.set(sessionId, session);

  try {
    await exec(
      'INSERT OR REPLACE INTO auth_sessions (session_id, wallet_address, authenticated, auto_payment_enabled, session_limit, session_spent, expires_at) VALUES (?, ?, 1, 1, ?, 0, ?)',
      [sessionId, cleanAddress, 1000000.0, expiresAt]
    );
  } catch (err) {
    console.warn('[Auth DB] Failed to persist session to database:', (err as Error).message);
  }

  console.log(`[Auth] Session created: ${sessionId} for ${cleanAddress}`);
  return session;
}

export async function getSession(sessionId?: string | null): Promise<SessionData | null> {
  if (!sessionId) return null;
  let session = sessions.get(sessionId);

  if (!session) {
    try {
      const rows = (await query('SELECT * FROM auth_sessions WHERE session_id = ?', [sessionId])) as unknown as {
        session_id: string;
        wallet_address: string;
        authenticated: number;
        auto_payment_enabled: number;
        session_limit: number;
        session_spent: number;
        expires_at: number;
        created_at: string;
      }[];

      if (rows && rows.length > 0) {
        const r = rows[0];
        if (Date.now() <= r.expires_at) {
          session = {
            sessionId: r.session_id,
            walletAddress: r.wallet_address,
            authenticated: Boolean(r.authenticated),
            connectedNetwork: 'MST Testnet',
            sessionCreatedAt: r.created_at || new Date().toISOString(),
            autoPaymentEnabled: Boolean(r.auto_payment_enabled),
            sessionLimit: r.session_limit || 1000000.0,
            sessionSpent: r.session_spent || 0,
            remaining: Math.max(0, (r.session_limit || 1000000.0) - (r.session_spent || 0)),
            expiresAt: r.expires_at,
          };
          sessions.set(sessionId, session);
        }
      }
    } catch (err) {
      console.warn('[Auth DB] getSession query failed:', (err as Error).message);
    }
  }

  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export async function authorizeSessionPayment(
  sessionId: string,
  maxSpendMstc: number = 1000000.0
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  const session = await getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Invalid or expired session' };
  }

  const limit = Math.max(100.0, maxSpendMstc || 1000000.0);
  session.autoPaymentEnabled = true;
  session.sessionLimit = limit;
  session.remaining = parseFloat((limit - session.sessionSpent).toFixed(6));

  sessions.set(sessionId, session);

  try {
    await exec(
      'UPDATE auth_sessions SET auto_payment_enabled = 1, session_limit = ? WHERE session_id = ?',
      [limit, sessionId]
    );
  } catch (err) {
    console.warn('[Auth DB] Failed to update session authorization in DB:', (err as Error).message);
  }

  console.log(`[Payment] Session authorization enabled: unlimited (${limit.toFixed(2)} MSTC)`);
  return { success: true, session };
}

export async function checkSessionAllowance(
  sessionId: string,
  requestedAmountMstc: number
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const session = await getSession(sessionId);
  if (!session) {
    return { allowed: false, remaining: 0, error: 'Session not authenticated' };
  }

  const remaining = session.sessionLimit - session.sessionSpent;
  return { allowed: true, remaining };
}

export async function deductSessionSpend(
  sessionId: string,
  amountMstc: number
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  const session = await getSession(sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  session.sessionSpent = parseFloat((session.sessionSpent + amountMstc).toFixed(6));
  session.remaining = parseFloat(Math.max(0, session.sessionLimit - session.sessionSpent).toFixed(6));

  sessions.set(sessionId, session);

  try {
    await exec('UPDATE auth_sessions SET session_spent = ? WHERE session_id = ?', [
      session.sessionSpent,
      sessionId,
    ]);
  } catch (err) {
    console.warn('[Auth DB] Failed to record session spend in DB:', (err as Error).message);
  }

  console.log(`[Payment] Deducted ${amountMstc.toFixed(4)} MSTC. Remaining: ${session.remaining.toFixed(4)} MSTC`);
  return { success: true, session };
}

export async function invalidateSession(sessionId?: string | null): Promise<boolean> {
  if (!sessionId) return false;
  const existed = sessions.delete(sessionId);
  try {
    await exec('DELETE FROM auth_sessions WHERE session_id = ?', [sessionId]);
  } catch {
    /* non-critical */
  }
  if (existed) {
    console.log(`[Auth] Session invalidated: ${sessionId}`);
  }
  return existed;
}

export async function invalidateWalletSessions(rawAddress: string): Promise<void> {
  try {
    const cleanAddress = ethers.getAddress(rawAddress.toLowerCase());
    for (const [sId, s] of sessions.entries()) {
      if (s.walletAddress.toLowerCase() === cleanAddress.toLowerCase()) {
        sessions.delete(sId);
        console.log(`[Auth] Invalidated session ${sId} for changed wallet ${cleanAddress}`);
      }
    }
    try {
      await exec('DELETE FROM auth_sessions WHERE wallet_address = ?', [cleanAddress]);
    } catch {
      /* non-critical */
    }
  } catch {
    // Ignore formatting errors
  }
}
