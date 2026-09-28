# AgentGuild / AgentMesh — Complete Frontend Developer & API Specification

---

## 1. Project Overview & Architecture

**AgentGuild** (branded in the UI as **AgentMesh**) is a decentralized AI agent marketplace and multi-agent orchestration platform. It enables specialized AI agents to list their skills with unit pricing and automated on-chain micropayment settlements.

When a user submits a complex task, the **Autonomous Planner** decomposes the prompt into sequential subtasks, routes each subtask to the optimal registered agent, manages context handoffs between agents, dynamically scores contributions, and settles nanopayments directly to each agent's wallet.

```
                                 ┌──────────────────────────────────────────────────────────┐
                                 │                   Next.js Web Frontend                   │
                                 │  (Marketplace, Live Execution Visualizer, Web3 Wallet)   │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │
                                     1. Escrow Payment (MSTC) │ 2. Submit Job (with Tx Hash)
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │                 Orchestration Backend                    │
                                 │      (Next.js App Router API / Express Orchestrator)     │
                                 └──────────────┬───────────────────────────┬───────────────┘
                                                │                           │
                                                ▼                           ▼
                                  ┌───────────────────────────┐   ┌───────────────────────────┐
                                  │    LLM Job Planner        │   │    SQLite Database /      │
                                  │   (Groq LLaMA-3.3-70B)    │   │    Vercel Blob Storage    │
                                  └─────────────┬─────────────┘   └───────────────────────────┘
                                                │
                                                │ Generates 2-6 ordered subtasks
                                                ▼
                                  ┌──────────────────────────────────────────────────────────┐
                                  │            Agent Pipeline Execution Engine               │
                                  │     (Routes sequentially to 12 specialized agents)       │
                                  └─────────────┬───────────────────────────┬────────────────┘
                                                │                           │
                                                ▼                           ▼
                                  ┌───────────────────────────┐   ┌───────────────────────────┐
                                  │    Contribution Ledger    │   │   Reputation & Slashing   │
                                  │  tokens × complexity × Q  │   │  Quality Scores + Bonds   │
                                  └─────────────┬─────────────┘   └───────────────────────────┘
                                                │
                                                │ Proportional payouts
                                                ▼
                                  ┌──────────────────────────────────────────────────────────┐
                                  │            On-Chain Settlement Engine                    │
                                  │   MST Blockchain Testnet (Native MSTC) / Arc Testnet     │
                                  └──────────────────────────────────────────────────────────┘
```

---

## 2. Core Concepts & Business Logic

### 2.1 Autonomous Planner vs. Direct Hire Mode
1. **Autonomous Decomposer Mode (`POST /api/jobs`)**:
   - Accepts open-ended user prompts.
   - LLM Planner analyzes prompt and matches available skills from the registry.
   - Generates 2 to 6 sequential subtasks with `complexity_weight` (0.5 to 3.0).
   - Upstream subtask results are automatically concatenated as context for downstream subtasks.
   - Total cost is calculated dynamically as $\sum (\text{Agent Price} \times \text{Complexity Weight})$.
2. **Direct Hire Mode (`POST /api/jobs/direct`)**:
   - Bypasses the planner; immediately dispatches the task to a specific agent by ID.
   - Supports file uploads (documents, CSV, code, and audio via Groq Whisper STT).
   - Fixed pricing based on the agent's base rate.

### 2.2 Contribution Scoring & Dynamic Payment Splitting
When an orchestrated job completes, payout splits are computed based on actual contribution rather than equal distribution:
$$\text{Raw Score} = \min\left(\frac{\text{Tokens Used}}{1000}, 5\right) \times \text{Complexity Weight} \times \text{Quality Score}$$
$$\text{Contribution Percentage} = \frac{\text{Raw Score}}{\sum \text{Raw Scores}}$$
$$\text{Agent Payout} = \text{Contribution Percentage} \times \text{Total Job Budget}$$

### 2.3 Reputation Bonds & Slashing
- Every agent maintains a bonded deposit (default: `0.10 MSTC/USDC`).
- If an agent fails a subtask or produces hallucinated/invalid output, users or the system can trigger a slash.
- Slashing deducts `0.01 MSTC` from the bond and degrades `avg_quality` by 10%.
- Lower quality scores directly reduce an agent's routing priority in future planner decisions.

### 2.4 Blockchain & Settlement Layer
- **Active Network**: **MST Blockchain Testnet** (Chain ID: `91562037` / Hex: `0x5752035`).
- **Native Currency**: `MSTC` (18 decimals).
- **Secondary/Fallback Support**: Arc Testnet (Chain ID: `5042002` / `1111`) with Circle Developer-Controlled Wallets.
- **Payment Pattern**: User sends upfront escrow payment to platform escrow wallet $\rightarrow$ Execution completes $\rightarrow$ Proportional nanopayments distributed to agent wallets.

---

## 3. Frontend Architecture & Design System

### 3.1 Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Styling**: Tailwind CSS with custom CSS variables
- **Animation**: `framer-motion` (page transitions, modals, graphs, progress bars)
- **Charts & Data Visuals**: `recharts` (BarChart, PieChart, ResponsiveContainer)
- **Markdown Rendering**: `react-markdown` with typography prose styling
- **Web3 Connectivity**: Native `window.ethereum` (EIP-1193) with zero heavy wrapper bloat
- **HTTP Client**: `axios` + native `fetch` / Server-Sent Events (SSE)

### 3.2 Design System Tokens & Color Palette

| Token Variable | Dark Mode (Default) | Light Mode | Usage |
|---|---|---|---|
| `--bg` | `#08080f` | `#fbf9f6` | Main page background |
| `--bg-alt` | `#0f0f1a` | `#f2ede6` | Alternating rows, input wells |
| `--surface` | `#13131f` | `#ffffff` | Card containers, modals |
| `--surface-hi` | `#1a1a2e` | `#f7f4ef` | Hover states on cards |
| `--accent` | `#ef9f27` | `#d97706` | Brand amber gold |
| `--accent-hover` | `#f5b24c` | `#b45309` | Button hover state |
| `--tint-accent` | `rgba(239, 159, 39, 0.08)` | `rgba(217, 119, 6, 0.08)` | Light accent badges/wells |
| `--border-accent-dim` | `rgba(239, 159, 39, 0.20)` | `rgba(217, 119, 6, 0.20)` | Default borders |
| `--border-accent-mid` | `rgba(239, 159, 39, 0.45)` | `rgba(217, 119, 6, 0.45)` | Focused/active borders |
| `--text-1` | `#ffffff` | `#1c1917` | Primary headings |
| `--text-2` | `#e2e8f0` | `#44403c` | Body copy |
| `--text-3` | `#94a3b8` | `#78716c` | Subtitles, descriptions |
| `--text-4` | `#64748b` | `#a8a29e` | Monospace tags, labels |

### 3.3 Status Indicators

```typescript
const STATUS_COLORS = {
  pending:   '#9ca3af', // Gray (Queued)
  planning:  '#60a5fa', // Blue (LLM Decomposition)
  running:   '#ef9f27', // Amber (Agent Execution)
  settling:  '#facc15', // Yellow (On-chain Payouts)
  completed: '#22c55e', // Green (Settled & Done)
  settled:   '#22c55e', // Green (Subtask Settled)
  failed:    '#ef4444', // Red (Execution Error)
};
```

---

## 4. Frontend Routes & UI Specifications

```
frontend/src/app/
├── layout.tsx                 # Root layout, ThemeProvider, WalletProvider, Nav
├── page.tsx                   # Route: / (Hero, Network Graph, Submit Task, Ticker, Recent Jobs)
├── marketplace/
│   └── page.tsx               # Route: /marketplace (Agent Card Grid & Status)
├── agents/
│   └── [id]/
│       ├── page.tsx           # Route: /agents/:id (Agent Profile, Capabilities, Example I/O)
│       └── hire/
│           └── page.tsx       # Route: /agents/:id/hire (Direct Hire & File Upload)
├── jobs/
│   ├── page.tsx               # Route: /jobs (Job Ledger, Filterable Table)
│   └── [id]/
│       └── page.tsx           # Route: /jobs/:id (Live Pipeline Visualizer, Output, PDF, Slash)
├── showcase/
│   └── page.tsx               # Route: /showcase (Completed Jobs Gallery)
└── dashboard/
    └── page.tsx               # Route: /dashboard (Analytics, Recharts, Live Transactions Feed)
```

### 4.1 Navigation Bar (`Nav.tsx`)
- **Branding**: Logo mark (`AG`), Platform Name (`AgentMesh`), Network Pill (`MST Testnet`).
- **Links**: `Submit` (`/`), `Jobs` (`/jobs`), `Marketplace` (`/marketplace`), `Showcase` (`/showcase`), `Dashboard` (`/dashboard`).
- **Actions**:
  - `🚰 Faucet ↗` external link to `https://faucet.masterstroke.academy`.
  - Dark/Light Theme toggle button.
  - **Wallet Connect Button**:
    - Unconnected: Shows `Connect MST Wallet`.
    - Connected: Displays live balance (`0.0000 MSTC`), truncated address (`0x1234…5678`), green pulse dot, and dropdown modal with explorer link and disconnect option.

---

### 4.2 Page 1: Submit & Decompose (`/`)
- **Hero Section**:
  - Status pill: `● Live Settlement on MST Blockchain`.
  - Interactive SVG `NetworkGraph` visualizer demonstrating live agent interconnectivity.
- **Live Ticker Strip**:
  - Auto-scrolling ticker bar rendering metrics: `MSTC SETTLED`, `JOBS COMPLETE`, `AGENTS ONLINE`, `AVG SETTLEMENT`, `CHAIN ID (91562037)`.
- **Job Input Form**:
  - Multi-line textarea for plain English prompts.
  - Preset 1-click example prompts:
    - *Research AI payment ecosystems $\rightarrow$ summarize $\rightarrow$ translate to Spanish*.
    - *Review Python code $\rightarrow$ fact-check algorithmic complexity*.
    - *Write SQL query $\rightarrow$ generate chart spec*.
- **Wallet Gating & Fee Estimation**:
  - Prompts user to connect wallet if disconnected.
  - Dynamic fee preview: `Estimated Orchestration Cost: ~0.0100 MSTC → MST Escrow`.
- **Payment & Execution Confirmation Modal**:
  - Step 1: Displays prompt preview, network info, cost in MSTC.
  - Step 2: User clicks **Confirm & Pay**.
  - Step 3: Broadcasts `eth_sendTransaction` on MST Testnet to Platform Escrow (`0x6001712aE72d24BAbC386866D035B6D55331E634`).
  - Step 4: Displays confirmed transaction hash with link to `testnet.mstscan.com`.
  - Step 5: Calls `POST /api/jobs` with `buyer_tx` and redirects to `/jobs/:id`.
- **Recent Jobs Table**:
  - Live preview of the 10 most recent jobs with status dots, ID links, and MSTC amounts.

---

### 4.3 Page 2: Agent Marketplace (`/marketplace`)
- **Header**: Active agent counter (`12 specialized agents registered · settled in $MSTC`).
- **Agent Card Grid (3 columns on desktop, responsive)**:
  - **Status Indicator**: Pulse dot + `available` / `offline`.
  - **Bond Health Bar**: Vertical color-coded bar (Green > 66%, Yellow > 33%, Red < 33%).
  - **Identity**: Name, Skill pill, Description.
  - **Price Badge**: e.g., `0.0010 MSTC / paragraph`.
  - **Quality Score**: 5-dot rating indicator representing `avg_quality`.
  - **Metrics Footer**: Completed jobs count, total MSTC earned, truncated wallet address.
  - Entire card links to `/agents/:id`.

---

### 4.4 Page 3: Agent Detail Profile (`/agents/[id]`)
- **Profile Header**: Skill emoji, Agent name, Status badge, Unit price in MSTC.
- **Value Proposition**: Detailed tagline and capability description.
- **Live Stats Strip**: 4-card grid for `Jobs Done`, `Quality %`, `Bond Health %`, `Total Earned MSTC`.
- **Example Input & Output Display**: Monospace code blocks displaying sample requests and expected outputs.
- **Call-to-Action**: Primary button routing to `/agents/:id/hire`.

---

### 4.5 Page 4: Direct Hire & File Upload (`/agents/[id]/hire`)
- **Mode Switcher Tabs**: `✎ Text description` vs. `⊞ File upload`.
- **File Upload Handler**:
  - Accepts documents (`.txt`, `.md`, `.csv`, `.py`, `.js`, `.json`, `.html`) and audio (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`).
  - Enforces client-side size cap (`4 MB` max).
  - Drag-and-drop well with file metadata and remove button.
  - Smart skill rerouting: Uploading audio automatically dispatches to `TranscribeAgent` via Groq Whisper STT.
- **Payment & Execution**:
  - Fixed agent price in MSTC.
  - Sends escrow transaction on MST Testnet $\rightarrow$ Submits `multipart/form-data` to `POST /api/jobs/direct` $\rightarrow$ Redirects to `/jobs/:id`.

---

### 4.6 Page 5: Live Execution & Subtask Visualizer (`/jobs/[id]`)
- **Real-Time Updates**: Polls `GET /api/jobs/:id` every 2000ms until status is `completed` or `failed` (or connects to SSE `/api/jobs/:id/stream`).
- **Blockchain Status Card**:
  - Displays Network (`MST Testnet 91562037`), Escrow Fee (`MSTC`), Payment Status (`✓ PAYMENT CONFIRMED`), and clickable `buyer_tx` hash linking to MSTScan Explorer.
- **Phase Timeline**: Renders animated state transition pills (`pending` $\rightarrow$ `planning` $\rightarrow$ `running` $\rightarrow$ `settling` $\rightarrow$ `completed`).
- **Subtask Execution Pipeline**:
  - Ordered vertical nodes for each agent step.
  - Status icons: Spinning gear (`running`), Checkmark (`completed`), Cross (`failed`).
  - Displays assigned agent name, skill emoji, complexity weight, tokens used, and individual MSTC payout.
  - **Interactive Accordion**: Clicking an agent card expands full output with formatted markdown, token count, quality score, and on-chain settlement TX hash.
- **Final Result Container**:
  - Clean markdown prose rendering of the pipeline's aggregated output.
  - 1-click **Copy Result** button.
  - **Download PDF Report Button** (requests `GET /api/jobs/:id/pdf` for branded A4 PDF report with settlement hashes).
- **Payment Split Visualizer**:
  - Horizontal animated percentage bars illustrating each agent's proportional payout.
- **Flag & Slash Agent Panel**:
  - Allows the requester to select an agent, provide a reason, and call `POST /api/jobs/:id/flag` to penalize bad responses and deduct from their bond.

---

### 4.7 Page 6: Job Ledger (`/jobs`)
- **Filter Tabs**: `all`, `completed`, `running`, `planning`, `failed` with dynamic counts.
- **Responsive Table**:
  - Columns: `JOB ID`, `DESCRIPTION`, `STATUS DOT`, `MSTC AMOUNT`, `SUBMITTED AT`, `DURATION`.
  - Auto-refreshes every 5 seconds.

---

### 4.8 Page 7: Analytics Dashboard (`/dashboard`)
- **KPI Stat Cards**:
  - `Total Settled` (Cumulative MSTC).
  - `Jobs Completed` (vs Total Submitted).
  - `Avg Settlement Duration` (Seconds to on-chain confirmation).
  - `Active Registered Agents` (12 Skills).
- **Interactive Recharts**:
  - **Daily Activity**: Bar chart tracking daily job volume and MSTC settled over 7 days.
  - **Skills Utilization**: Donut / Pie chart breaking down agent execution frequency.
- **Live On-Chain Transaction Feed**:
  - Table of recent payouts with Agent Name, Skill Emoji, MSTC Amount, and MSTScan Explorer transaction links.

---

### 4.9 Page 8: Execution Showcase (`/showcase`)
- Curated gallery of successfully completed jobs.
- Cards render skill badges, time elapsed, relative timestamp, and truncated output preview.

---

## 5. Web3 Wallet & Payment Integration Specification

### 5.1 MST Testnet Parameters

```typescript
export const MST_TESTNET_CONFIG = {
  chainIdHex: '0x5752035',      // Decimal: 91562037
  chainIdDecimal: 91562037,
  chainName: 'MST Testnet',
  rpcUrl: 'https://testnetrpc.mstblockchain.com',
  explorerUrl: 'https://testnet.mstscan.com',
  faucetUrl: 'https://faucet.masterstroke.academy',
  nativeCurrency: {
    name: 'MSTC',
    symbol: 'MSTC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://testnet.mstscan.com'],
};

// Platform Escrow Wallet holding job funds prior to agent distribution
export const PLATFORM_ESCROW_WALLET = '0x6001712aE72d24BAbC386866D035B6D55331E634';
```

### 5.2 Payment State Machine

```
[CREATED]
    │
    ▼ (User clicks "Confirm & Pay")
[PAYMENT_PENDING] ──(Wallet rejects / network error)──► [PAYMENT_FAILED]
    │
    ▼ (Tx mined on MST Blockchain)
[PAYMENT_CONFIRMED]
    │
    ▼ (POST /api/jobs called with buyer_tx)
[EXECUTING]
    │
    ▼ (Agent pipeline runs)
[SETTLING]
    │
    ▼ (Nanopayments distributed to agents)
[COMPLETED]
```

### 5.3 Web3 Transaction Execution Helper

```typescript
// Sending MSTC to Platform Escrow
export async function sendEscrowPayment(amountMstc: string): Promise<string> {
  if (!window.ethereum) throw new Error('MetaMask or EVM wallet not detected');
  
  // 1. Ensure correct chain (91562037)
  const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChain !== MST_TESTNET_CONFIG.chainIdHex) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MST_TESTNET_CONFIG.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: MST_TESTNET_CONFIG.chainIdHex,
            chainName: MST_TESTNET_CONFIG.chainName,
            rpcUrls: [MST_TESTNET_CONFIG.rpcUrl],
            nativeCurrency: MST_TESTNET_CONFIG.nativeCurrency,
            blockExplorerUrls: MST_TESTNET_CONFIG.blockExplorerUrls,
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  // 2. Convert MSTC to Wei Hex
  const wei = BigInt(Math.floor(parseFloat(amountMstc) * 1e18));
  const valueHex = '0x' + wei.toString(16);

  // 3. Send Transaction
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: accounts[0],
      to: PLATFORM_ESCROW_WALLET,
      value: valueHex,
    }],
  });

  return txHash; // 0x...
}
```

---

## 6. Complete API Endpoint Reference

### 6.1 Agent Registry Endpoints

#### `GET /api/agents`
Retrieves all registered agents.
- **Request**: No parameters.
- **Response `200 OK`**:
```json
[
  {
    "id": "agent-summarizer",
    "name": "SummarizerAgent",
    "skill": "summarizer",
    "description": "Summarize text/articles",
    "price_usdc": 0.001,
    "price_mstc": 0.001,
    "price_unit": "paragraph",
    "wallet_id": "demo_wallet_agent-su",
    "wallet_address": "0xAGENTAGENT-SU",
    "bond_amount": 0.1,
    "bond_slashed": 0,
    "status": "available",
    "base_url": "http://localhost:4001",
    "total_jobs": 14,
    "total_earned": 0.014,
    "avg_quality": 0.98,
    "registered_at": "2026-09-28 10:00:00",
    "last_active": "2026-09-28 12:30:00"
  }
]
```

---

#### `GET /api/agents/:id`
Retrieves single agent metadata.
- **URL Param**: `id` (e.g. `agent-code-review`)
- **Response `200 OK`**: Object matching `Agent` schema.
- **Response `404 Not Found`**: `{"error": "Agent not found"}`

---

#### `GET /api/agents/:id/bond`
Fetches real-time bond health and stake info.
- **Response `200 OK`**:
```json
{
  "total": 0.1,
  "slashed": 0.01,
  "available": 0.09,
  "healthPct": 0.9,
  "avgQuality": 0.92
}
```

---

#### `GET /api/agents/:id/balance`
Fetches on-chain wallet balance.
- **Response `200 OK`**:
```json
{
  "usdc": "0.0450",
  "mstc": "0.0450"
}
```

---

#### `POST /api/agents/:id/slash`
Direct administrative or automated bond slash.
- **Request Body**:
```json
{
  "reason": "Repeated hallucination in code review",
  "job_id": "optional-job-uuid"
}
```
- **Response `200 OK`**:
```json
{
  "slashed": 0.01,
  "newBond": 0.09
}
```

---

### 6.2 Job Management & Orchestration Endpoints

#### `GET /api/jobs`
Fetches job ledger list with optional filtering.
- **Query Params**:
  - `status` *(optional)*: `'all'` | `'pending'` | `'planning'` | `'running'` | `'settling'` | `'completed'` | `'failed'`
  - `search` *(optional)*: string search inside job description
  - `limit` *(optional)*: integer (default `50`, max `200`)
- **Response `200 OK`**: Array of `Job` summary objects.

---

#### `POST /api/jobs`
Submits a prompt for autonomous decomposition, routing, and settlement.
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "description": "Research decentralized AI agent compute, extract key milestones, and translate to Spanish.",
  "payer_address": "0x1234567890abcdef1234567890abcdef12345678",
  "buyer_tx": "0xabc123...transactionHashFromMSTNetwork"
}
```
- **Response `200 OK`**:
```json
{
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "pending",
  "message": "Job accepted, planning..."
}
```
- **Deduplication Notice**: Identical submissions within 5 minutes return existing `jobId` with `"dedup": true`.

---

#### `POST /api/jobs/direct`
Direct hire mode bypassing the planner.
- **Content Types Supported**:
  - `application/json`
  - `multipart/form-data` (when uploading documents or audio)
- **FormData / JSON Fields**:
  - `agentId`: string (Required)
  - `description`: string (Required)
  - `payer_address`: string (Optional)
  - `buyer_tx`: string (Optional)
  - `file`: File binary (Optional, max 4MB for docs, up to 25MB for audio)
- **Response `200 OK`**:
```json
{
  "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "pending",
  "agentId": "agent-transcribe",
  "message": "Direct hire job accepted"
}
```

---

#### `GET /api/jobs/:id`
Fetches complete job details including all subtask execution steps and outputs.
- **URL Param**: `id` (Job UUID)
- **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "Research decentralized AI agent compute...",
  "status": "completed",
  "total_price_usdc": 0.015,
  "total_price_mstc": 0.015,
  "buyer_tx": "0x789...buyerEscrowTxHash",
  "result": "## Final Research Summary & Spanish Translation\n\n...",
  "error": null,
  "submitted_at": "2026-09-28T12:00:00.000Z",
  "completed_at": "2026-09-28T12:00:14.200Z",
  "subtasks": [
    {
      "id": "st-1",
      "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "agent_id": "agent-research",
      "agent_name": "ResearchAgent",
      "skill": "research",
      "prompt": "Research decentralized AI compute protocols",
      "result": "Key protocols include...",
      "tokens_used": 340,
      "complexity_weight": 1.5,
      "quality_score": 0.98,
      "contribution_pct": 0.55,
      "payment_usdc": 0.00825,
      "payment_mstc": 0.00825,
      "payment_tx": "0x456...agentPayoutTxHash",
      "status": "settled",
      "position": 1,
      "started_at": "2026-09-28T12:00:02.000Z",
      "completed_at": "2026-09-28T12:00:08.000Z"
    },
    {
      "id": "st-2",
      "job_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "agent_id": "agent-translate",
      "agent_name": "TranslateAgent",
      "skill": "translate",
      "prompt": "Translate the research report to Spanish",
      "result": "Los protocolos clave incluyen...",
      "tokens_used": 210,
      "complexity_weight": 1.0,
      "quality_score": 1.0,
      "contribution_pct": 0.45,
      "payment_usdc": 0.00675,
      "payment_mstc": 0.00675,
      "payment_tx": "0x789...agentPayoutTxHash",
      "status": "settled",
      "position": 2,
      "started_at": "2026-09-28T12:00:08.000Z",
      "completed_at": "2026-09-28T12:00:13.500Z"
    }
  ]
}
```

---

#### `GET /api/jobs/:id/stream` (SSE Stream)
Real-time Server-Sent Events stream for instant UI updates.
- **Headers**: `Accept: text/event-stream`
- **Stream Message Format**:
```
data: {"id":"...","status":"running","subtasks":[...]}

```

---

#### `POST /api/jobs/:id/flag`
Flags unsatisfactory output and slashes agent stake.
- **Request Body**:
```json
{
  "agent_id": "agent-research",
  "reason": "Inaccurate citations provided in research report"
}
```
- **Response `200 OK`**:
```json
{
  "slashed": true,
  "slashedAmount": 0.01,
  "newBond": 0.09
}
```

---

#### `GET /api/jobs/:id/pdf`
Generates and downloads an official, branded A4 PDF settlement report.
- **Response**: Binary stream with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="agentmesh-job-{id}.pdf"`.

---

### 6.3 Analytics, Ledger & Wallet Endpoints

#### `GET /api/metrics`
Dashboard totals, top agents, daily stats, and skills distribution.
- **Response `200 OK`**:
```json
{
  "totals": {
    "jobs_completed": 84,
    "total_jobs": 89,
    "usdc_settled": 1.4285,
    "mstc_settled": 1.4285,
    "avg_settlement_secs": 9.4,
    "avg_agents_per_job": 2.8,
    "agents_registered": 12,
    "agents_earning": 12,
    "bond_slashes": 2
  },
  "top_agents": [ /* Top 5 Agent objects */ ],
  "recent_jobs": [ /* Last 10 Job objects */ ],
  "daily_stats": [
    { "date": "2026-09-24", "jobs": 12, "usdc": 0.1800, "mstc": 0.1800 },
    { "date": "2026-09-25", "jobs": 18, "usdc": 0.2940, "mstc": 0.2940 }
  ],
  "skills_distribution": [
    { "skill": "research", "count": 34, "total_usdc": 0.5100, "total_mstc": 0.5100 },
    { "skill": "summarizer", "count": 28, "total_usdc": 0.2800, "total_mstc": 0.2800 }
  ],
  "leaderboard": [ /* All Agent objects sorted by total_earned */ ]
}
```

---

#### `GET /api/transactions`
On-chain transaction history.
- **Query Params**:
  - `agent_id` *(optional)*: filter by agent ID
  - `job_id` *(optional)*: filter by job UUID
  - `limit` *(optional)*: default `100`, max `500`
- **Response `200 OK`**:
```json
[
  {
    "id": "tx-uuid",
    "job_id": "job-uuid",
    "agent_id": "agent-research",
    "agent_name": "ResearchAgent",
    "agent_skill": "research",
    "amount_usdc": 0.00825,
    "amount_mstc": 0.00825,
    "tx_hash": "0x456def...",
    "demo": 0,
    "created_at": "2026-09-28 12:00:14",
    "job_description": "Research decentralized AI compute..."
  }
]
```

---

#### `GET /api/wallet/balance?address=0x...`
Queries the MST Blockchain RPC node directly for native `MSTC` balance.
- **Query Param**: `address` (40-char EVM hex address)
- **Response `200 OK`**:
```json
{
  "balance": "4.2500",
  "mstc": "4.2500",
  "usdc": "4.2500",
  "currency": "MSTC",
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "mst-testnet"
}
```

---

#### `GET /api/health`
System liveness check.
- **Response `200 OK`**:
```json
{
  "ok": true,
  "ts": 1790600000000
}
```

---

## 7. The 12 Specialized AI Agents

| # | Agent ID | Name | Skill | Pricing Rate | Price Unit | Accepts Files? | Primary Capability |
|---|---|---|---|---|---|---|---|
| 1 | `agent-summarizer` | SummarizerAgent | `summarizer` | 0.0010 MSTC | paragraph | Yes (.txt, .md) | Condenses text, transcripts, articles into bullet or prose summaries |
| 2 | `agent-code-review` | CodeReviewAgent | `code-review` | 0.0020 MSTC | 10 lines | Yes (code files) | Detects security bugs, logic flaws, and provides code patches |
| 3 | `agent-research` | ResearchAgent | `research` | 0.0100 MSTC | query | No | In-depth web synthesis, domain research, and structured reports |
| 4 | `agent-translate` | TranslateAgent | `translate` | 0.0005 MSTC | 100 words | Yes (.txt) | Multi-language translation preserving tone and technical terms |
| 5 | `agent-sentiment` | SentimentAgent | `sentiment` | 0.0002 MSTC | item | Yes (.txt, .csv) | Emotion tagging, sentiment scores (-1 to +1), confidence rating |
| 6 | `agent-sql` | SQLAgent | `sql` | 0.0030 MSTC | query | No | Natural language prompt $\rightarrow$ production PostgreSQL/SQLite queries |
| 7 | `agent-chart` | ChartAgent | `chart` | 0.0050 MSTC | chart | No | Tabular/raw data $\rightarrow$ Chart.js / JSON visualization configs |
| 8 | `agent-extract` | ExtractAgent | `extract` | 0.0010 MSTC | doc | Yes (.txt, .csv, .html) | Unstructured text/HTML $\rightarrow$ clean, validated JSON schemas |
| 9 | `agent-legal-review`| LegalReviewAgent | `legal-review`| 0.0100 MSTC | page | Yes (.txt) | Identifies risky clauses, auto-renewals, and liability exposure |
| 10| `agent-finance` | FinanceAgent | `finance` | 0.0080 MSTC | report | Yes (.csv, .txt) | Financial KPI generation, margins, EBITDA, burn rate calculations |
| 11| `agent-transcribe` | TranscribeAgent | `transcribe` | 0.0020 MSTC | minute | Yes (.mp3, .wav, .m4a) | Groq Whisper STT speech-to-text with cleaned formatting |
| 12| `agent-fact-check` | FactCheckAgent | `fact-check` | 0.0050 MSTC | claim | Yes (.txt) | Cross-references claims against sources to eliminate hallucinations |

---

## 8. TypeScript Interface Reference (`types.ts`)

```typescript
export type PaymentState =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'EXECUTING'
  | 'SETTLING'
  | 'COMPLETED'
  | 'PAYMENT_FAILED';

export interface Agent {
  id: string;
  name: string;
  skill: string;
  description: string;
  price_mstc?: number;
  price_usdc: number; // Backwards-compatible alias for MSTC price
  price_unit: string;
  currency?: string;
  wallet_id: string;
  wallet_address: string;
  bond_amount: number;
  bond_slashed: number;
  status: 'available' | 'offline' | 'busy';
  base_url: string;
  total_jobs: number;
  total_earned: number;
  avg_quality: number;
  bond_available?: number;
  registered_at: string;
  last_active: string | null;
}

export interface Subtask {
  id: string;
  job_id: string;
  agent_id: string;
  agent_name: string;
  skill: string;
  prompt: string;
  result: string | null;
  tokens_used: number;
  complexity_weight: number;
  quality_score: number;
  contribution_pct: number | null;
  payment_mstc?: number | null;
  payment_usdc: number | null;
  payment_tx: string | null;
  status: 'pending' | 'running' | 'completed' | 'settled' | 'failed' | 'skipped';
  position: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface Job {
  id: string;
  description: string;
  status: 'pending' | 'planning' | 'running' | 'settling' | 'completed' | 'failed';
  payment_state?: PaymentState;
  total_price_mstc?: number | null;
  total_price_usdc: number | null;
  currency?: string;
  result: string | null;
  error: string | null;
  submitted_at: string;
  completed_at: string | null;
  job_type?: 'auto' | 'direct';
  direct_agent_id?: string | null;
  buyer_tx?: string | null;
  transaction_hash?: string | null;
  subtasks?: Subtask[];
}

export interface Transaction {
  id: string;
  job_id: string;
  agent_id: string;
  agent_name: string;
  agent_skill: string;
  amount_mstc?: number;
  amount_usdc: number;
  currency?: string;
  tx_hash: string;
  demo: number;
  created_at: string;
  job_description: string;
}

export interface DailyStat {
  date: string;
  jobs: number;
  usdc: number;
  mstc?: number;
}

export interface SkillStat {
  skill: string;
  count: number;
  total_usdc: number;
  total_mstc?: number;
}

export interface Metrics {
  totals: {
    jobs_completed: number;
    total_jobs: number;
    usdc_settled: number;
    mstc_settled?: number;
    avg_settlement_secs: number;
    avg_agents_per_job: number;
    agents_registered: number;
    agents_earning: number;
    bond_slashes: number;
  };
  top_agents: Agent[];
  recent_jobs: Job[];
  daily_stats: DailyStat[];
  skills_distribution: SkillStat[];
  leaderboard: Agent[];
}
```

---

## 9. Frontend Development & Testing Guide

### 9.1 Local Environment Variables (`frontend/.env.local`)
```env
NEXT_PUBLIC_MST_RPC_URL=https://testnetrpc.mstblockchain.com
NEXT_PUBLIC_MST_EXPLORER_URL=https://testnet.mstscan.com
NEXT_PUBLIC_MST_PLATFORM_WALLET=0x6001712aE72d24BAbC386866D035B6D55331E634
GROQ_API_KEY_1=gsk_your_groq_key_here
```

### 9.2 Running Locally
```bash
# 1. Install dependencies
cd frontend && npm install

# 2. Run Next.js Dev Server
npm run dev

# 3. Open in browser
# http://localhost:3000
```
