import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { simulationRouter } from "./routes/simulation.js";
import { SimulationEngine } from "./simulation/engine.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:3000" },
});

app.use(cors());
app.use(express.json());

const engine = new SimulationEngine(io);

app.use("/api/simulation", simulationRouter(engine));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", simulation: engine.isRunning ? "running" : "stopped" });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit("simulation_state", engine.getState());

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT ?? 4000;
httpServer.listen(PORT, () => {
  console.log(`Sigil backend running on http://localhost:${PORT}`);
});
