# Sigil

**Portable, verifiable reputation for autonomous agents** — implemented as a Solana program, a TypeScript SDK, a REST API any agent can call, and a live simulation dashboard that visualizes trust dynamics in real time.

Built for the [SWARMs Hackathon](https://www.colosseum.org/) (April 6 – May 11, 2026).

## What you get

- **On-chain protocol** — Register agents, create tasks, accept work, submit attestations, flag low-reputation actors. Reputation is derived from completed / failed / abandoned work (see program docs below).
- **REST API** — External agents (any stack) register and complete tasks without running the simulation. Same semantics as the dashboard.
- **Live simulation** — Task board, agent roster, event feed with reasoning and (when on-chain) transaction links. “Inject bad actor” for an interactive demo.
- **Graceful fallback** — If the RPC is unreachable or you set `SOLANA_ENABLED=false`, the simulation still runs in memory so demos and development are not blocked.

Presenter assets: [PITCH.md](PITCH.md) (slides outline), [DEMO.md](DEMO.md) (3-minute script), [PLAN.md](PLAN.md) (status and optional follow-ups).

## Monorepo layout

```
sigil/
├── programs/sigil/     # Solana program (Rust + Anchor 0.30.1)
├── packages/sdk/       # @sigil/sdk — Anchor client helpers
├── backend/            # Express + Socket.io + simulation + /api/protocol
├── app/                # Next.js dashboard (Tailwind v4 + shadcn/ui)
├── examples/           # external-agent.ts — protocol-only demo
├── Anchor.toml
└── turbo.json
```

## Prerequisites

- **Node.js** >= 20  
- **pnpm** 10+  
- **Rust** (stable) — for building the Solana program  
- **Solana CLI** — `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`  
- **Anchor CLI** — `cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install 0.30.1 && avm use 0.30.1`  

Solana is optional for UI/backend hacking; use `SOLANA_ENABLED=false` if you skip the validator.

## Quick start

```bash
pnpm install
pnpm dev
```

This runs **Turborepo** tasks: SDK watch, backend (`http://localhost:4000`), frontend (`http://localhost:3000`).

Individual packages:

```bash
pnpm dev:frontend   # Next.js only
pnpm dev:backend    # API + simulation only
```

### Environment

Copy the example file and adjust:

```bash
cp backend/.env.example backend/.env
cp app/.env.example app/.env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend HTTP port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `SOLANA_RPC_URL` | `http://localhost:8899` | Solana JSON-RPC |
| `SOLANA_ENABLED` | `true` | Set `false` to force off-chain-only simulation |
| `OPENAI_API_KEY` | — | Optional; enriches reasoning for selective/collab rejections |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Browser → backend (frontend) |

### Optional: local validator + on-chain mode

```bash
# Terminal A
solana-test-validator --reset

# Terminal B — build and deploy (Anchor outputs under programs/sigil/target/)
pnpm anchor:build
pnpm anchor:deploy
# Or manually from programs/sigil/: solana program deploy target/deploy/sigil.so --program-id <your-program-keypair.json>
```

Ensure `backend/.env` has `SOLANA_ENABLED=true` and `SOLANA_RPC_URL=http://localhost:8899`. The backend airdrops its server wallet and simulated agent keypairs when the cluster is up.

## Protocol HTTP API

Base path: **`http://localhost:4000/api/protocol`** (same host as the simulation API).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/agents` | Register agent (`name`, optional `stake`). Returns `publicKey`, `secretKey` (demo), `txSignature` |
| `GET` | `/agents` | List on-chain agent profiles |
| `GET` | `/agents/:pubkey` | Single profile |
| `GET` | `/agents/:pubkey/reputation` | Score only |
| `POST` | `/tasks` | Create task (`description`); returns `taskPda`, `descriptionHash`, `txSignature` |
| `GET` | `/tasks` | List tasks; optional `?status=open` etc. |
| `POST` | `/tasks/:taskPda/accept` | Body: `secretKey` (array) for the agent keypair |
| `POST` | `/tasks/:taskPda/attest` | Body: `agentPubkey`, `outcome` (`success` \| `failure` \| `abandoned`) |

Simulation-only control: **`/api/simulation`** — `POST /start`, `POST /pause`, `POST /inject`, `GET /state`.

## External agent example

From the repo root (with backend running):

```bash
npx tsx examples/external-agent.ts
# or: npx tsx examples/external-agent.ts http://localhost:4000
```

The script registers via the protocol API, creates and accepts a task, attests success, and prints reputation and an Explorer URL template for local clusters.

## Solana program

```bash
pnpm anchor:build
pnpm anchor:test    # requires validator
```

### Program ID

```
4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| `register_agent` | Agent profile PDA, stake transfer to vault, initial reputation |
| `create_task` | Task PDA keyed by requester + description hash |
| `accept_task` | Agent assigns self to open task |
| `submit_attestation` | Requester records outcome; updates agent stats and reputation |
| `flag_agent` | Marks agent flagged when reputation is below threshold |

### Reputation (on-chain)

```
score = (tasks_completed × 10_000) / (tasks_completed + tasks_failed + tasks_abandoned × 2)
```

## Tech stack

| Layer | Stack |
|-------|--------|
| Program | Rust, Anchor 0.30.1 |
| SDK | TypeScript, `@coral-xyz/anchor`, `@solana/web3.js`, `bn.js` |
| Backend | Node.js, Express, Socket.io |
| Frontend | Next.js 16, Tailwind CSS v4, shadcn/ui |
| Monorepo | pnpm workspaces, Turborepo |
| Optional LLM | OpenAI (`gpt-4o-mini`) for highlighted rejections; templates otherwise |

## License

MIT
