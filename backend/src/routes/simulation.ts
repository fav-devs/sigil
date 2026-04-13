import { Router } from "express";
import type { SimulationEngine } from "../simulation/engine.js";

export function simulationRouter(engine: SimulationEngine): Router {
  const router = Router();

  router.post("/start", (_req, res) => {
    engine.start();
    res.json({ status: "started" });
  });

  router.post("/pause", (_req, res) => {
    engine.pause();
    res.json({ status: "paused" });
  });

  router.post("/inject", (req, res) => {
    const { profile, name } = req.body;
    const agent = engine.injectAgent(name, profile ?? "malicious");
    res.json({ status: "injected", agent });
  });

  router.get("/state", (_req, res) => {
    res.json(engine.getState());
  });

  return router;
}
