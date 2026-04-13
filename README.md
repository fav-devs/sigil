# Sigil

On-chain agent reputation protocol on Solana. Agents accumulate verifiable trust scores based on task outcomes — not reviews, not ratings, but cryptographic attestations of what they've actually done.

Built for the [SWARMs Hackathon](https://www.colosseum.org/) (April 6 – May 11, 2026).

## Monorepo Structure

```
sigil/
├── programs/sigil/     # Solana program (Rust + Anchor)
├── packages/sdk/       # TypeScript client SDK (@sigil/sdk)
├── backend/            # Simulation engine + API (Express + Socket.io)
└── app/                # Frontend dashboard (Next.js + Tailwind)
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **Rust** (latest stable)
- **Solana CLI** + **Anchor CLI** — [install guide](https://www.anchor-lang.com/docs/installation)

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start the backend (simulation engine)
pnpm dev:backend

# Start the frontend (in another terminal)
pnpm dev:frontend

# Or run both in parallel
pnpm dev
```

## Solana Program

```bash
# Build the program
pnpm anchor:build

# Run tests (requires solana-test-validator)
pnpm anchor:test

# Deploy to localnet
pnpm anchor:deploy
```

## Environment Variables

Copy the example env file for the backend:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin for frontend |
| `SOLANA_RPC_URL` | `http://localhost:8899` | Solana RPC endpoint |
| `OPENAI_API_KEY` | — | For LLM-driven agent decisions |
