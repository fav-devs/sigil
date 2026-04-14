import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { simulationRouter } from "./routes/simulation.js";
import { protocolRouter } from "./routes/protocol.js";
import { SimulationEngine } from "./simulation/engine.js";
import { SolanaService } from "./services/solana.js";
import { LLMService } from "./services/llm.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:3000" },
});

app.use(cors());
app.use(express.json());

const solanaEnabled = process.env.SOLANA_ENABLED !== "false";
const rpcUrl = process.env.SOLANA_RPC_URL ?? "http://localhost:8899";
const solana = new SolanaService(rpcUrl, solanaEnabled);
const llm = new LLMService(process.env.OPENAI_API_KEY);
const engine = new SimulationEngine(io, solana, llm);

app.use("/api/simulation", simulationRouter(engine));
app.use("/api/protocol", protocolRouter(solana));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    simulation: engine.isRunning ? "running" : "stopped",
    solana: solana.enabled ? "connected" : "disabled",
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit("simulation_state", engine.getState());

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

async function main() {
  await solana.initialize();
  console.log(`[solana] Mode: ${solana.enabled ? "ON-CHAIN" : "IN-MEMORY"}`);

  const PORT = process.env.PORT ?? 4000;
  httpServer.listen(PORT, () => {
    console.log(`Sigil backend running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
