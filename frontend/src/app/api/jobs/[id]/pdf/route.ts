import { NextRequest, NextResponse } from 'next/server';
import { query, reloadFromBlob } from '@/lib/server/db';
import { getExplorerUrl } from '@/blockchain/mst';
import { extractMultiArtifacts, isValidChartSpec, isValidTableSpec, isValidFactCheckSpec, isFactCheckArray, isValidWebsiteSpec, normalizeArtifact } from '@/lib/artifacts/normalizer';
import type { ChartSpec, TableSpec, FactCheckSpec, WebsiteSpec } from '@/lib/artifacts/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFDoc = any;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function truncateTx(tx: string) {
  if (!tx) return '';
  return `${tx.slice(0, 14)}…${tx.slice(-10)}`;
}

function drawVectorWebsite(doc: PDFDoc, site: WebsiteSpec) {
  if (doc.y > 620) {
    doc.addPage();
    doc.y = 50;
  }

  const boxY = doc.y;
  const brand = site.brand || site.name || 'E-Commerce Website';

  doc.roundedRect(50, boxY, 495, 110, 6).fill('#0f172a');
  doc.roundedRect(50, boxY, 495, 110, 6).strokeColor('#334155').lineWidth(1).stroke();

  // Header Title
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#f8fafc').text(`✓ Website Built — ${brand}`, 65, boxY + 12);
  doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8').text(`Category: ${site.category || "Men's Fashion"}   ·   Status: Build ${site.buildStatus?.toUpperCase() || 'PASSED'}   ·   Debug Retries: ${site.debugAttempts ?? 0}`, 65, boxY + 28);

  // Pages grid
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#e2e8f0').text('Generated Store Pages:', 65, boxY + 46);
  const pages = (site.pages || []).slice(0, 6);
  pages.forEach((p, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const px = 65 + col * 230;
    const py = boxY + 62 + row * 14;
    doc.fontSize(8).font('Helvetica').fillColor('#10b981').text(`✓ ${p.name}`, px, py, { continued: true });
    doc.fillColor('#64748b').text(`  (${p.path})`);
  });

  doc.y = boxY + 120;
  doc.moveDown(0.5);
}

function drawVectorFactCheck(doc: PDFDoc, factCheck: FactCheckSpec) {
  const items = factCheck.items || [];
  if (items.length === 0) return;

  if (doc.y > 640) {
    doc.addPage();
    doc.y = 50;
  }

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('✓ Fact Check Results', 50, doc.y);
  doc.moveDown(0.4);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (doc.y > 680) {
      doc.addPage();
      doc.y = 50;
    }

    const verdictLower = String(item.verdict || 'uncertain').toLowerCase();
    const isTrue = verdictLower === 'true' || verdictLower === 'mostly-true' || verdictLower === 'verified';
    const isFalse = verdictLower === 'false' || verdictLower === 'mostly-false' || verdictLower === 'debunked';
    const color = isTrue ? '#15803d' : isFalse ? '#b91c1c' : '#b45309';
    const bg = isTrue ? '#f0fdf4' : isFalse ? '#fef2f2' : '#fffbeb';
    const label = isTrue ? '✓ TRUE' : isFalse ? '✕ FALSE' : '? UNCERTAIN';

    const boxY = doc.y;
    doc.roundedRect(50, boxY, 495, 48, 4).fill(bg);
    doc.roundedRect(50, boxY, 495, 48, 4).strokeColor(isTrue ? '#bbf7d0' : isFalse ? '#fecaca' : '#fde68a').lineWidth(0.5).stroke();

    // Claim
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827').text(`Claim ${i + 1}: "${item.claim}"`, 60, boxY + 8, { width: 360 });

    // Verdict pill
    doc.roundedRect(440, boxY + 8, 95, 16, 8).fill(color);
    let confStr = '';
    if (typeof item.confidence === 'number') {
      const pct = item.confidence <= 1 ? Math.round(item.confidence * 100) : Math.round(item.confidence);
      confStr = ` · ${pct}%`;
    }
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text(`${label}${confStr}`, 440, boxY + 12, { width: 95, align: 'center' });

    // Explanation
    if (item.explanation) {
      doc.fontSize(8).font('Helvetica').fillColor('#374151').text(item.explanation, 60, boxY + 24, { width: 475, height: 20 });
    }

    doc.y = boxY + 54;
  }
  doc.moveDown(0.5);
}

function drawVectorBarChart(doc: PDFDoc, chart: ChartSpec) {
  const startX = 60;
  const chartWidth = 475;
  const plotHeight = 110;

  const labels = chart.data?.labels || [];
  const datasets = chart.data?.datasets || [];
  const title = chart.options?.title?.text || 'Visual Chart';

  // Check if we need a new page
  if (doc.y > 620) {
    doc.addPage();
    doc.y = 50;
  }

  const boxStartY = doc.y + 4;
  const totalBoxHeight = plotHeight + 70;

  // Background Box
  doc.roundedRect(50, boxStartY, 495, totalBoxHeight, 6).fill('#f9fafb');
  doc.roundedRect(50, boxStartY, 495, totalBoxHeight, 6).strokeColor('#e5e7eb').lineWidth(1).stroke();

  // Chart Title
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#111827').text(title, 65, boxStartY + 10);

  const plotY = boxStartY + 30;
  const plotWidth = 440;
  const baselineY = plotY + plotHeight;

  // Compute scale
  let maxVal = 0;
  datasets.forEach(ds => {
    (ds.data || []).forEach(v => {
      const num = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
      if (num > maxVal) maxVal = num;
    });
  });
  if (maxVal <= 0) maxVal = 100;
  const scaleMax = Math.ceil(maxVal * 1.15);

  // Draw Horizontal Gridlines & Y-Axis values
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const tickVal = Math.round((scaleMax / ticks) * t);
    const tickY = baselineY - (plotHeight / ticks) * t;
    doc.moveTo(startX, tickY).lineTo(startX + plotWidth, tickY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#6b7280').text(String(tickVal), startX - 22, tickY - 3, { width: 18, align: 'right' });
  }

  // Draw X Baseline
  doc.moveTo(startX, baselineY).lineTo(startX + plotWidth, baselineY).strokeColor('#9ca3af').lineWidth(1).stroke();

  // Draw Bars
  const numGroups = Math.max(1, labels.length);
  const groupWidth = plotWidth / numGroups;
  const numBarsPerGroup = Math.max(1, datasets.length);
  const barWidth = Math.min(32, Math.max(12, (groupWidth * 0.65) / numBarsPerGroup));

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'];

  labels.forEach((label, gIdx) => {
    const groupCenterX = startX + gIdx * groupWidth + groupWidth / 2;
    const groupStartX = groupCenterX - (numBarsPerGroup * barWidth) / 2;

    datasets.forEach((ds, dIdx) => {
      const rawVal = ds.data[gIdx] ?? 0;
      const val = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
      const barHeight = Math.max(2, (val / scaleMax) * plotHeight);
      const barX = groupStartX + dIdx * barWidth;
      const barY = baselineY - barHeight;

      // Draw rounded/flat bar
      doc.rect(barX, barY, barWidth - 3, barHeight).fill(colors[dIdx % colors.length]);

      // Value label on bar
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#1f2937')
         .text(String(val), barX - 4, barY - 9, { width: barWidth + 5, align: 'center' });
    });

    // Label under baseline
    doc.fontSize(8).font('Helvetica').fillColor('#374151')
       .text(String(label), groupCenterX - groupWidth / 2, baselineY + 5, { width: groupWidth, align: 'center' });
  });

  // Legend at bottom
  const legendY = baselineY + 22;
  let legendX = startX + 10;
  datasets.forEach((ds, dIdx) => {
    const dsName = ds.label || `Dataset ${dIdx + 1}`;
    doc.rect(legendX, legendY + 2, 7, 7).fill(colors[dIdx % colors.length]);
    doc.fontSize(7.5).font('Helvetica').fillColor('#4b5563').text(dsName, legendX + 11, legendY);
    legendX += doc.widthOfString(dsName) + 26;
  });

  doc.y = boxStartY + totalBoxHeight + 10;
}

function drawVectorTable(doc: PDFDoc, table: TableSpec) {
  const startX = 50;
  const tableWidth = 495;
  const colWidth = Math.floor(tableWidth / Math.max(1, table.columns.length));

  if (doc.y > 640) {
    doc.addPage();
    doc.y = 50;
  }

  // Header row
  doc.rect(startX, doc.y, tableWidth, 18).fill('#f3f4f6');
  doc.rect(startX, doc.y, tableWidth, 18).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  table.columns.forEach((col, idx) => {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827')
       .text(String(col), startX + idx * colWidth + 6, doc.y + 4, { width: colWidth - 12 });
  });
  doc.y += 18;

  // Rows
  table.rows.forEach((row, rIdx) => {
    if (doc.y > 720) {
      doc.addPage();
      doc.y = 50;
    }
    const bg = rIdx % 2 === 0 ? '#ffffff' : '#fafafa';
    doc.rect(startX, doc.y, tableWidth, 16).fill(bg);
    doc.rect(startX, doc.y, tableWidth, 16).strokeColor('#f3f4f6').lineWidth(0.5).stroke();
    row.forEach((cell, cIdx) => {
      doc.fontSize(8).font('Helvetica').fillColor('#374151')
         .text(String(cell ?? ''), startX + cIdx * colWidth + 6, doc.y + 3, { width: colWidth - 12 });
    });
    doc.y += 16;
  });

  doc.moveDown(0.6);
}

function renderMarkdownToPdf(doc: PDFDoc, text: string) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      doc.moveDown(0.25);
      continue;
    }

    if (line.startsWith('### ')) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text(line.slice(4), { lineGap: 1 });
      doc.moveDown(0.15);
    } else if (line.startsWith('## ')) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111111').text(line.slice(3), { lineGap: 1 });
      doc.moveDown(0.2);
    } else if (line.startsWith('# ')) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(line.slice(2), { lineGap: 1 });
      doc.moveDown(0.25);
    } else if (line.match(/^[-•*]\s/)) {
      const content = line
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .slice(2);
      doc.fontSize(10).font('Helvetica').fillColor('#1a1a1a').text(`•  ${content}`, { indent: 10, lineGap: 1.5 });
    } else if (line.match(/^\d+\.\s/)) {
      const content = line
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
      doc.fontSize(10).font('Helvetica').fillColor('#1a1a1a').text(content, { indent: 10, lineGap: 1.5 });
    } else if (line.startsWith('```')) {
      // skip code fence markers
    } else {
      const cleaned = line
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      if (cleaned.trim()) {
        doc.fontSize(10).font('Helvetica').fillColor('#1a1a1a').text(cleaned, { lineGap: 2 });
      }
    }
  }
}

function sectionHeader(doc: PDFDoc, title: string) {
  const y = doc.y;
  doc.rect(50, y, 3, 16).fill('#ef9f27');
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#111111').text(title, 60, y);
  doc.fillColor('#1a1a1a');
  doc.moveDown(0.5);
}

function divider(doc: PDFDoc) {
  doc.moveDown(0.6);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
  doc.moveDown(0.8);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let jobRows = await query('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!jobRows[0]) {
      await reloadFromBlob();
      jobRows = await query('SELECT * FROM jobs WHERE id = ?', [id]);
    }
    if (!jobRows[0]) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const job = jobRows[0] as Record<string, unknown>;

    const subtasks = (await query(
      `SELECT st.*, a.name as agent_name, a.skill
       FROM subtasks st LEFT JOIN agents a ON a.id = st.agent_id
       WHERE st.job_id = ? ORDER BY st.position`,
      [id]
    )) as Record<string, unknown>[];

    const PDFDocument = (await import('pdfkit')).default;
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `AgentMesh Job Report — ${id.slice(0, 8)}`,
        Author: 'AgentMesh Platform',
        Subject: 'AI Agent Job & MST Blockchain Settlement Report',
        CreationDate: new Date(),
      },
    });

    const endPromise = new Promise<void>(resolve => doc.on('end', resolve));
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // ── Branded header block ──────────────────────────────────────────────────
    doc.rect(0, 0, 595, 88).fill('#08080f');

    // AG logo box
    doc.roundedRect(46, 20, 46, 46, 5).fill('#13131f');
    doc.roundedRect(46, 20, 46, 46, 5).strokeColor('#ef9f27').lineWidth(1.5).stroke();
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#ef9f27').text('AG', 46, 30, { width: 46, align: 'center' });

    // Title
    doc.fontSize(26).font('Helvetica-Bold').fillColor('#ffffff').text('Agent', 103, 22, { continued: true });
    doc.fillColor('#ef9f27').text('Mesh');
    doc.fontSize(9).font('Helvetica').fillColor('#aaaaaa')
       .text('AI Agent Orchestration  ·  Settled on MST Blockchain (Testnet 91562037)', 103, 51);
    doc.fontSize(7.5).fillColor('#666666')
       .text(`Generated ${new Date().toUTCString()}  ·  Network: MST Testnet  ·  Currency: MSTC`, 103, 64);

    // Status pill top-right
    const statusText = String(job.status ?? '').toUpperCase();
    const statusColor = statusText === 'COMPLETED' ? '#22c55e' : statusText === 'FAILED' ? '#ef4444' : '#ef9f27';
    doc.roundedRect(440, 28, 105, 22, 11).fill(statusColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
       .text(statusText, 440, 33, { width: 105, align: 'center' });

    doc.fillColor('#000000');
    doc.y = 105;
    doc.moveDown(0.5);

    // ── Job Request ───────────────────────────────────────────────────────────
    sectionHeader(doc, 'Job Request');

    doc.fontSize(11).font('Helvetica').fillColor('#000000').text(String(job.description ?? ''), { lineGap: 3 });
    doc.moveDown(0.5);

    const jobType = String(job.job_type ?? 'auto');
    doc.fontSize(8.5).font('Helvetica').fillColor('#888888')
      .text(`Job ID: ${id}`, { continued: true })
      .text(`   ·   Type: ${jobType === 'direct' ? 'Direct Hire' : 'Auto-Decompose'}`, { continued: true })
      .text(`   ·   Submitted: ${String(job.submitted_at ?? '').slice(0, 16)} UTC`);
    if (job.completed_at) {
      doc.text(`Completed: ${String(job.completed_at).slice(0, 16)} UTC`);
    }

    divider(doc);

    // ── Agents ────────────────────────────────────────────────────────────────
    sectionHeader(doc, 'Agent(s) Involved & Splits');

    if (subtasks.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999999').text('No subtasks recorded.');
    } else {
      for (const st of subtasks) {
        const name = String(st.agent_name ?? st.skill ?? 'Unknown Agent');
        const skill = String(st.skill ?? '');
        const stStatus = String(st.status ?? '');
        const payment = typeof st.payment_usdc === 'number' ? `${st.payment_usdc.toFixed(4)} MSTC` : '—';
        const pct = typeof st.contribution_pct === 'number' ? ` (${(st.contribution_pct * 100).toFixed(1)}%)` : '';

        if (stStatus === 'settled') {
          doc.rect(50, doc.y - 2, 495, 18).fill('#fffdf0');
          doc.fillColor('#000000');
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111').text(name, { continued: true });
        doc.font('Helvetica').fillColor('#888888').text(`  [${skill}]`, { continued: true });
        doc.fillColor('#ef9f27').font('Helvetica-Bold').text(`  ${payment}${pct}`, { continued: false });
        doc.fillColor('#000000');

        if (st.payment_tx) {
          doc.fontSize(8).font('Courier').fillColor('#777777')
             .text(`  MST Tx: ${truncateTx(String(st.payment_tx))}   (${getExplorerUrl(String(st.payment_tx))})`);
          doc.fillColor('#000000');
        }
        doc.moveDown(0.3);
      }
    }

    divider(doc);

    // ── Final Result & Artifacts ─────────────────────────────────────────────
    sectionHeader(doc, 'Execution Deliverables & Artifacts');

    const deliverables: { title: string; agent?: string; content: string }[] = [];

    if (subtasks.length > 1) {
      for (const st of subtasks) {
        if (st.result && typeof st.result === 'string' && st.result.trim().length > 0) {
          deliverables.push({
            title: String(st.agent_name || `${st.skill} Output`),
            agent: String(st.agent_name || st.skill),
            content: String(st.result),
          });
        }
      }
    } else {
      const resultText = String(job.result ?? '');
      if (resultText) {
        deliverables.push({ title: 'Execution Deliverable', content: resultText });
      }
    }

    if (deliverables.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#999999').text('No output recorded.');
    } else {
      for (const d of deliverables) {
        const composite = extractMultiArtifacts(d.content, d.agent);

        if (composite.narrative) {
          renderMarkdownToPdf(doc, composite.narrative);
          doc.moveDown(0.4);
        }

        for (const art of composite.artifacts) {
          if (art.type === 'website' && isValidWebsiteSpec(art.data)) {
            drawVectorWebsite(doc, art.data);
          } else if (art.type === 'fact_check' && (isValidFactCheckSpec(art.data) || isFactCheckArray((art.data as any)?.items || art.data))) {
            const spec: FactCheckSpec = isValidFactCheckSpec(art.data)
              ? art.data
              : { type: 'fact_check', items: Array.isArray(art.data) ? art.data : (art.data as any)?.items || [] };
            drawVectorFactCheck(doc, spec);
          } else if (art.type === 'chart' && isValidChartSpec(art.data)) {
            drawVectorBarChart(doc, art.data);
          } else if (art.type === 'table' && isValidTableSpec(art.data)) {
            drawVectorTable(doc, art.data);
          } else if (art.type === 'code') {
            doc.rect(50, doc.y, 495, 24).fill('#1e1e2e');
            doc.fontSize(8.5).font('Courier').fillColor('#10b981').text(art.rawContent, 60, doc.y + 6);
            doc.moveDown(1);
          } else if (art.type === 'markdown' && art.rawContent !== composite.narrative) {
            renderMarkdownToPdf(doc, art.rawContent);
            doc.moveDown(0.4);
          }
        }
      }
    }

    divider(doc);

    // ── Payment & Settlement ──────────────────────────────────────────────────
    sectionHeader(doc, 'MST Blockchain Settlement');

    const totalMstc = typeof job.total_price_usdc === 'number' ? job.total_price_usdc : 0;
    const settled = subtasks.filter(st => st.status === 'settled');

    doc.rect(50, doc.y, 495, 28).fill('#fffdf5');
    doc.fillColor('#000000');
    doc.fontSize(11).font('Helvetica').fillColor('#444444').text('Total Settled:', 60, doc.y + 8, { continued: true });
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#ef9f27').text(`  ${totalMstc.toFixed(4)} MSTC`);
    doc.y += 36;
    doc.moveDown(0.3);

    doc.fontSize(8.5).font('Helvetica').fillColor('#888888')
       .text(`Network: MST Blockchain Testnet (91562037)  ·  Explorer: testnet.mstscan.com  ·  Settlement: On-chain native MSTC`);
    doc.fillColor('#000000');

    // Buyer → Platform tx
    if (job.buyer_tx) {
      doc.moveDown(0.6);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#22c55e').text('Buyer → Platform Escrow (MSTC Transfer)');
      doc.fontSize(8).font('Courier').fillColor('#555555').text(`  Tx: ${String(job.buyer_tx)}`);
      doc.fontSize(7.5).font('Helvetica').fillColor('#22c55e')
         .text(`  ${getExplorerUrl(String(job.buyer_tx))}`);
      doc.fillColor('#000000');
    }

    doc.moveDown(2);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.rect(50, doc.y, 495, 0.5).fill('#e0e0e0');
    doc.moveDown(0.5);
    doc.fontSize(7.5).font('Helvetica').fillColor('#aaaaaa').text('AgentMesh  ·  AI Agent Marketplace & Orchestration Platform', {
      align: 'center',
    });
    doc.fontSize(7).fillColor('#cccccc').text('testnetrpc.mstblockchain.com  ·  testnet.mstscan.com  ·  Settled on MST Blockchain', {
      align: 'center',
    });

    doc.end();
    await endPromise;

    const pdfBuffer = Buffer.concat(chunks);
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="agentmesh-job-${id.slice(0, 8)}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[PDF] Error:', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
