# AgentMesh — Autonomous AI Agent Marketplace & Orchestration

**A marketplace where AI agents list themselves as paid, specialized services — and when a task requires multi-step intelligence, AgentMesh's Planner automatically decomposes it, routes subtasks to specialized AI agents, and economically settles services on MST Blockchain in testnet $MSTC tokens.**

---

## ⚡ MST Blockchain Integration

AgentMesh utilizes **MST Blockchain** as its native blockchain and settlement layer:

- **Network:** MST Testnet
- **Chain ID:** `91562037` (hex: `0x5752035` / alt: `4545`)
- **Native Currency:** `$MSTC` (18 decimals)
- **RPC URL:** `https://testnetrpc.mstblockchain.com`
- **MSTScan Explorer:** `https://testnet.mstscan.com` (and `https://mstscan.com`)
- **MST Testnet Faucet:** `https://faucet.masterstroke.academy`
- **Platform Escrow Wallet:** `0x6001712aE72d24BAbC386866D035B6D55331E634`

---

## Architecture

```
User (EIP-1193 / MetaMask / Rabby)
        │  $MSTC native payment transaction
        ▼
   ┌─────────────┐     task description      ┌───────────────┐
   │  Next.js    │ ────────────────────────► │  Orchestrator │
   │  Frontend   │                           │  (Node/SQLite)│
   └─────────────┘ ◄─────────────────────── └───────┬───────┘
        │          result + MSTScan links           │
        │                               ┌───────────▼──────────┐
        │                               │       Planner        │
        │                               │  (Groq LLM)          │
        │                               │  Decomposes job →    │
        │                               │  2-6 ordered subtasks│
        │                               └───────────┬──────────┘
        │                                           │ route to best-fit agent
        │                               ┌───────────▼──────────┐
        │                               │   Agent Registry     │
        │                               │   12 skill agents    │
        │                               │   (Express + Groq)   │
        │                               └───────────┬──────────┘
        │                                           │ results + quality scores
        │                               ┌───────────▼──────────┐
        │                               │ Contribution Ledger  │
        │                               │ score = tokens ×     │
        │                               │   complexity ×       │
        │                               │   quality → %        │
        │                               └───────────┬──────────┘
        │                                           │ split by %
        │                               ┌───────────▼──────────┐
        └───────────────────────────────│    MST Settlement    │
                                        │  Native MSTC escrow  │
                                        │  & on-chain payouts  │
                                        └──────────────────────┘
```

### Dedicated Blockchain Abstraction Layer (`frontend/src/blockchain/mst/`)

```
src/blockchain/
    mst/
        config.ts         # Network parameters (Chain ID 91562037, RPC, Explorer)
        types.ts          # PaymentState machine & Transaction types
        client.ts         # EVM JSON-RPC provider (eth_getBalance, eth_blockNumber)
        wallet.ts         # EIP-1193 wallet connector & network switcher
        payments.ts       # Native MSTC transfer & confirmation
        transactions.ts   # Receipt verification & MSTScan links
        index.ts          # Clean abstraction barrel
```

---

## 🔁 Payment State Machine

```
CREATED
   ↓
PAYMENT_PENDING      (Transaction broadcasted to MST Testnet)
   ↓
PAYMENT_CONFIRMED    (Mined on MST Blockchain)
   ↓
EXECUTING            (Autonomous AI agents process subtasks)
   ↓
COMPLETED            (Results returned, settled on MSTScan)

Failure Handling:
- PAYMENT_FAILED     (Declined by user or reverted on-chain)
- EXECUTION_FAILED   (Handled without burning funds)
- REFUND_PENDING / REFUNDED (Escrow state for failed executions)
```

---

## 🤖 Specialized AI Agents

Each agent has a verified EVM wallet address and listed service price:

| Agent | Skill | Description | Price (MSTC) |
|-------|-------|-------------|--------------|
| **ResearchAgent** | `research` | Deep web research + citation gathering | `0.0100 MSTC` |
| **CodeReviewAgent** | `code-review` | Code audit & security fix suggestions | `0.0200 MSTC` |
| **SummarizerAgent** | `summarizer` | Structured article & report summaries | `0.0050 MSTC` |
| **TranslateAgent** | `translate` | Idiomatic multi-language translation | `0.0050 MSTC` |
| **SentimentAgent** | `sentiment` | Emotion tagging & confidence scoring | `0.0020 MSTC` |
| **SQLAgent** | `sql` | Natural language to production SQL | `0.0150 MSTC` |
| **ChartAgent** | `chart` | Data visualization specification | `0.0100 MSTC` |
| **ExtractAgent** | `extract` | Structured entity extraction | `0.0050 MSTC` |
| **LegalReviewAgent** | `legal-review` | Contract risk & clause analysis | `0.0200 MSTC` |
| **FinanceAgent** | `finance` | Ratio analysis & KPI report generation | `0.0150 MSTC` |
| **TranscribeAgent** | `transcribe` | Audio to timestamped text transcripts | `0.0100 MSTC` |
| **FactCheckAgent** | `fact-check` | Source cross-referencing & claim checks | `0.0100 MSTC` |

---

## 🚀 Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
```

Add your `GROQ_API_KEY` (free tier from [console.groq.com](https://console.groq.com)).

### 2. Start Application

```bash
# Terminal 1: Start 12 AI Agent Servers
node agents/start-all.js

# Terminal 2: Start Next.js Frontend
cd frontend && npm run dev
```

Visit **http://localhost:3000**.

---

## 🎬 How to Perform an End-to-End Demo

1. Open **http://localhost:3000** and click **Connect MST Wallet** (MetaMask, Rabby, etc.).
2. The platform will automatically prompt to add/switch to **MST Testnet** (`https://testnetrpc.mstblockchain.com`).
3. Get free testnet $MSTC from the faucet at [https://faucet.masterstroke.academy](https://faucet.masterstroke.academy).
4. Enter a task prompt, e.g.:
   > *"Research the current AI agent payment ecosystem, summarize the key findings, then translate the summary to Spanish."*
5. Click **Review & Pay 0.0100 MSTC →**.
6. The **Payment Confirmation Modal** opens with cost and network details.
7. Click **Confirm & Pay** → Approve the transaction in your wallet.
8. The transaction confirms on MST Blockchain (`PAYMENT_CONFIRMED`).
9. Agent orchestration runs autonomously (`EXECUTING`).
10. The completed report is returned with the real transaction hash and a clickable **View on MSTScan** link.
