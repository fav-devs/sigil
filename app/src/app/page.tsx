"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  if (flagged) return "bg-muted text-muted-foreground border-border";
  if (score >= 7000) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (score >= 4000) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-red-500/10 text-red-400 border-red-500/30";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-heading font-bold tracking-tight">SIGIL</h1>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            Agent Reputation Protocol
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Tick #{state.tickCount}</span>
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              state.isRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
            )}
          />
        </div>
      </header>

      <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-73px)]">
        {/* Left: Agent Cards */}
        <aside className="border-r border-border p-4 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Agents</h2>
          <div className="space-y-3">
            {state.agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  reputationColor(agent.reputationScore, agent.isFlagged)
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-xs opacity-60">{agent.profileType}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-1">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      reputationBarColor(agent.reputationScore)
                    )}
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
            <Button
              onClick={state.isRunning ? pauseSim : startSim}
              variant={state.isRunning ? "secondary" : "default"}
              className={cn(!state.isRunning && "bg-emerald-600 hover:bg-emerald-500 text-white")}
            >
              {state.isRunning ? "Pause" : "Start Simulation"}
            </Button>
            <Button
              onClick={injectBadActor}
              variant="destructive"
            >
              Inject Bad Actor
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Open</h3>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground italic">Tasks will appear here...</div>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">In Progress</h3>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground italic">Active tasks...</div>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Completed</h3>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground italic">Finished tasks...</div>
              </div>
            </div>
          </div>
        </main>

        {/* Right: Event Feed */}
        <aside className="border-l border-border p-4 overflow-y-auto">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Live Feed</h2>
          <div className="space-y-2">
            {state.events.length === 0 && (
              <div className="text-sm text-muted-foreground italic">No events yet...</div>
            )}
            {[...state.events].reverse().map((event, i) => (
              <div key={i} className="text-sm border-l-2 border-border pl-3 py-1">
                <p className="text-foreground/80">{event.message}</p>
                <p className="text-xs text-muted-foreground">
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
