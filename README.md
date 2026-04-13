# Sigil

On-chain agent reputation protocol on Solana. Agents accumulate verifiable trust scores based on task outcomes — not reviews, not ratings, but cryptographic attestations of what they've actually done.

Built for the [SWARMs Hackathon](https://www.colosseum.org/) (April 6 – May 11, 2026).

## Monorepo Structure

```
sigil/
├── programs/sigil/        # Solana program (Rust + Anchor 0.30.1)
├── packages/sdk/          # TypeScript client SDK (@sigil/sdk)
├── backend/               # Simulation engine + API (Express + Socket.io)
├── app/                   # Frontend dashboard (Next.js 16 + Tailwind v4 + shadcn/ui)
├── Anchor.toml            # Anchor workspace config
└── turbo.json             # Turborepo task pipeline
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** 10+
- **Rust** (stable)
- **Solana CLI** — `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- **Anchor CLI** — `cargo install --git https://github.com/coral-xyz/anchor avm --force && avm install 0.30.1 && avm use 0.30.1`

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start all dev servers (frontend + backend + sdk watch) with Turborepo TUI
pnpm dev

# Or start individually
pnpm dev:frontend   # Next.js on http://localhost:3000
pnpm dev:backend    # Express + Socket.io on http://localhost:4000
```

## Solana Program

```bash
# Start the local validator
solana-test-validator --reset

# Build the program
pnpm anchor:build

# Deploy to localnet (airdrop SOL first)
solana airdrop 5
solana program deploy target/deploy/sigil.so --program-id target/deploy/sigil-keypair.json

# Run tests (requires running validator)
pnpm anchor:test
```

### Program ID

```
4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| `register_agent` | Create agent profile PDA, stake SOL, start at 5000 reputation |
| `create_task` | Create a new task with a description hash |
| `accept_task` | Assign an open task to the calling agent |
| `submit_attestation` | Requester evaluates outcome, updates agent reputation |
| `flag_agent` | Flag agents whose reputation drops below 2000 |

### Reputation Formula

```
score = (tasks_completed × 10,000) / (tasks_completed + tasks_failed + tasks_abandoned × 2)
```

Abandoned tasks are penalized 2x — accepting work and ghosting is worse than trying and failing.

## Environment Variables

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin for frontend |
| `SOLANA_RPC_URL` | `http://localhost:8899` | Solana RPC endpoint |
| `OPENAI_API_KEY` | — | For LLM-driven agent decisions |

## Tech Stack

| Layer | Tool |
|-------|------|
| On-chain program | Rust + Anchor (Solana) |
| Backend | Node.js + Express + Socket.io |
| Frontend | Next.js 16 + Tailwind v4 + shadcn/ui |
| SDK | TypeScript + @coral-xyz/anchor + @solana/web3.js |
| Monorepo | pnpm workspaces + Turborepo |
| LLM layer | OpenAI API (GPT-4o) |

## License

MIT
