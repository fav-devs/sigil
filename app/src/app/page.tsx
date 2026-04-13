"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface Agent {
  id: string;
  name: string;
  profileType: string;
  reputationScore: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksAbandoned: number;
  status: "idle" | "working" | "flagged";
  isFlagged: boolean;
}

interface SimEvent {
  type: string;
  agentId?: string;
  message: string;
  timestamp: number;
}

interface SimulationState {
  isRunning: boolean;
  tickCount: number;
  agents: Agent[];
  events: SimEvent[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function reputationColor(score: number, flagged: boolean): string {
  if (flagged) return "bg-gray-800 text-gray-400";
  if (score >= 7000) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (score >= 4000) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
  return "bg-red-500/20 text-red-400 border-red-500/40";
}

function reputationBarColor(score: number): string {
  if (score >= 7000) return "bg-emerald-500";
  if (score >= 4000) return "bg-amber-500";
  return "bg-red-500";
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    tickCount: 0,
    agents: [],
    events: [],
  });

  useEffect(() => {
    const s = io(API_URL);
    setSocket(s);

    s.on("simulation_state", (data: SimulationState) => setState(data));
    s.on("agent_updated", (agent: Agent) => {
      setState((prev) => {
        const existing = prev.agents.findIndex((a) => a.id === agent.id);
        const agents = [...prev.agents];
        if (existing >= 0) agents[existing] = agent;
        else agents.push(agent);
        return { ...prev, agents };
      });
    });
    s.on("event", (event: SimEvent) => {
      setState((prev) => ({
        ...prev,
        events: [...prev.events.slice(-49), event],
      }));
    });
    s.on("tick", (data: { tickCount: number }) => {
      setState((prev) => ({ ...prev, tickCount: data.tickCount }));
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const startSim = () => fetch(`${API_URL}/api/simulation/start`, { method: "POST" });
  const pauseSim = () => fetch(`${API_URL}/api/simulation/pause`, { method: "POST" });
  const injectBadActor = () =>
    fetch(`${API_URL}/api/simulation/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: "malicious",
        name: `Rogue-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      }),
    });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">SIGIL</h1>
          <span className="text-xs text-gray-500 uppercase tracking-widest">
            Agent Reputation Protocol
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Tick #{state.tickCount}</span>
          <span
            className={`h-2 w-2 rounded-full ${state.isRunning ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}
          />
        </div>
      </header>

      <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-73px)]">
        {/* Left: Agent Cards */}
        <aside className="border-r border-gray-800 p-4 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Agents</h2>
          <div className="space-y-3">
            {state.agents.map((agent) => (
              <div
                key={agent.id}
                className={`rounded-lg border p-3 transition-all ${reputationColor(agent.reputationScore, agent.isFlagged)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-xs opacity-60">{agent.profileType}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${reputationBarColor(agent.reputationScore)}`}
                    style={{ width: `${agent.reputationScore / 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs opacity-70">
                  <span>{agent.reputationScore.toLocaleString()} / 10,000</span>
                  <span>{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Task Board + Controls */}
        <main className="p-6 overflow-y-auto">
          <div className="flex gap-3 mb-8">
            <button
              onClick={state.isRunning ? pauseSim : startSim}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                state.isRunning
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {state.isRunning ? "Pause" : "Start Simulation"}
            </button>
            <button
              onClick={injectBadActor}
              className="px-5 py-2.5 rounded-lg font-medium text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Inject Bad Actor
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Open</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 italic">Tasks will appear here...</div>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">In Progress</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 italic">Active tasks...</div>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Completed</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 italic">Finished tasks...</div>
              </div>
            </div>
          </div>
        </main>

        {/* Right: Event Feed */}
        <aside className="border-l border-gray-800 p-4 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Live Feed</h2>
          <div className="space-y-2">
            {state.events.length === 0 && (
              <div className="text-sm text-gray-600 italic">No events yet...</div>
            )}
            {[...state.events].reverse().map((event, i) => (
              <div key={i} className="text-sm border-l-2 border-gray-700 pl-3 py-1">
                <p className="text-gray-300">{event.message}</p>
                <p className="text-xs text-gray-600">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
