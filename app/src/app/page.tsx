"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────

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
  publicKey?: string;
  currentTaskId?: string;
}

interface Task {
  id: string;
  description: string;
  requester: string;
  assignee: string | null;
  status: "open" | "assigned" | "completed";
  outcome: "success" | "failure" | "abandoned" | null;
  createdAt: number;
  completedAt: number | null;
  txSignature?: string;
  taskPda?: string;
}

interface SimEvent {
  type: string;
  agentId?: string;
  taskId?: string;
  message: string;
  reasoning?: string;
  txSignature?: string;
  timestamp: number;
}

interface SimulationState {
  isRunning: boolean;
  tickCount: number;
  agents: Agent[];
  tasks: Task[];
  events: SimEvent[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const EXPLORER_BASE = "https://explorer.solana.com/tx";

function txLink(sig: string) {
  return `${EXPLORER_BASE}/${sig}?cluster=custom&customUrl=http://localhost:8899`;
}

// ── Helpers ────────────────────────────────────────────────────────────

function repColor(score: number, flagged: boolean) {
  if (flagged) return "text-muted-foreground";
  if (score >= 7000) return "text-emerald-400";
  if (score >= 4000) return "text-amber-400";
  return "text-red-400";
}

function repBarColor(score: number) {
  if (score >= 7000) return "bg-emerald-500";
  if (score >= 4000) return "bg-amber-500";
  return "bg-red-500";
}

function statusDot(status: Agent["status"]) {
  if (status === "working") return "bg-blue-400 animate-pulse";
  if (status === "flagged") return "bg-red-500 animate-pulse";
  return "bg-emerald-500/60";
}

function eventColor(type: string) {
  switch (type) {
    case "agent_registered":
      return "border-l-blue-500";
    case "task_created":
      return "border-l-zinc-500";
    case "task_accepted":
      return "border-l-sky-500";
    case "task_completed":
      return "border-l-emerald-500";
    case "task_rejected":
      return "border-l-amber-500";
    case "agent_flagged":
      return "border-l-red-500";
    default:
      return "border-l-border";
  }
}

function outcomeBadge(outcome: Task["outcome"]) {
  if (!outcome) return null;
  const variants: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    failure: "bg-red-500/15 text-red-400 border-red-500/30",
    abandoned: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  return (
    <span
      className={cn(
        "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border",
        variants[outcome]
      )}
    >
      {outcome}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function Home() {
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    tickCount: 0,
    agents: [],
    tasks: [],
    events: [],
  });
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [repHistory, setRepHistory] = useState<
    Record<string, { tick: number; score: number }[]>
  >({});
  const feedRef = useRef<HTMLDivElement>(null);

  // Track reputation changes for flash effect
  const [repFlash, setRepFlash] = useState<Record<string, "up" | "down">>({});
  const prevReps = useRef<Record<string, number>>({});

  const handleAgentUpdate = useCallback((agent: Agent) => {
    setState((prev) => {
      const idx = prev.agents.findIndex((a) => a.id === agent.id);
      const agents = [...prev.agents];
      if (idx >= 0) agents[idx] = agent;
      else agents.push(agent);
      return { ...prev, agents };
    });

    const prevScore = prevReps.current[agent.id];
    if (prevScore !== undefined && prevScore !== agent.reputationScore) {
      const dir = agent.reputationScore > prevScore ? "up" : "down";
      setRepFlash((f) => ({ ...f, [agent.id]: dir }));
      setTimeout(() => {
        setRepFlash((f) => {
          const next = { ...f };
          delete next[agent.id];
          return next;
        });
      }, 1200);
    }
    prevReps.current[agent.id] = agent.reputationScore;
  }, []);

  const handleTaskUpdate = useCallback((task: Task) => {
    setState((prev) => {
      const idx = prev.tasks.findIndex((t) => t.id === task.id);
      const tasks = [...prev.tasks];
      if (idx >= 0) tasks[idx] = task;
      else tasks.push(task);
      return { ...prev, tasks };
    });
  }, []);

  useEffect(() => {
    const s = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("simulation_state", (data: SimulationState) => {
      setState(data);
      for (const a of data.agents) {
        prevReps.current[a.id] = a.reputationScore;
      }
    });
    s.on("agent_updated", handleAgentUpdate);
    s.on("task_updated", handleTaskUpdate);
    s.on("event", (event: SimEvent) => {
      setState((prev) => ({
        ...prev,
        events: [...prev.events.slice(-99), event],
      }));
    });
    s.on("tick", (data: { tickCount: number; state?: SimulationState }) => {
      if (data.state) {
        setState(data.state);
        for (const a of data.state.agents) {
          const prev = prevReps.current[a.id];
          if (prev !== undefined && prev !== a.reputationScore) {
            const dir = a.reputationScore > prev ? "up" : "down";
            setRepFlash((f) => ({ ...f, [a.id]: dir }));
            setTimeout(() => {
              setRepFlash((f) => {
                const next = { ...f };
                delete next[a.id];
                return next;
              });
            }, 1200);
          }
          prevReps.current[a.id] = a.reputationScore;
        }
      } else {
        setState((prev) => ({ ...prev, tickCount: data.tickCount }));
      }

      setRepHistory((prev) => {
        const next = { ...prev };
        setState((s) => {
          for (const a of s.agents) {
            const arr = next[a.id] ?? [];
            arr.push({ tick: data.tickCount, score: a.reputationScore });
            if (arr.length > 50) arr.shift();
            next[a.id] = arr;
          }
          return s;
        });
        return next;
      });
    });

    return () => {
      s.disconnect();
    };
  }, [handleAgentUpdate, handleTaskUpdate]);

  const startSim = () =>
    fetch(`${API_URL}/api/simulation/start`, { method: "POST" });
  const pauseSim = () =>
    fetch(`${API_URL}/api/simulation/pause`, { method: "POST" });
  const injectBadActor = () =>
    fetch(`${API_URL}/api/simulation/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: "malicious",
        name: `Rogue-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      }),
    });

  const openTasks = state.tasks.filter((t) => t.status === "open");
  const assignedTasks = state.tasks.filter((t) => t.status === "assigned");
  const completedTasks = state.tasks
    .filter((t) => t.status === "completed")
    .slice(-20)
    .reverse();

  const totalAttestations = state.tasks.filter(
    (t) => t.status === "completed"
  ).length;

  const detail = selectedAgent
    ? state.agents.find((a) => a.id === selectedAgent)
    : null;
  const detailHistory = selectedAgent ? repHistory[selectedAgent] ?? [] : [];
  const detailTasks = selectedAgent
    ? state.tasks.filter(
        (t) => t.assignee === selectedAgent
      )
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            SIGIL
          </h1>
          <span className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
            Agent Reputation Protocol
          </span>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              {state.agents.length}{" "}
              <span className="opacity-60">agents</span>
            </span>
            <span>
              {state.tasks.length}{" "}
              <span className="opacity-60">tasks</span>
            </span>
            <span>
              {totalAttestations}{" "}
              <span className="opacity-60">attestations</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={state.isRunning ? pauseSim : startSim}
              variant={state.isRunning ? "secondary" : "default"}
              className={cn(
                "text-xs",
                !state.isRunning &&
                  "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}
            >
              {state.isRunning ? "Pause" : "Start"}
            </Button>
            <Button size="sm" variant="destructive" onClick={injectBadActor} className="text-xs">
              Inject Bad Actor
            </Button>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-3">
            {!connected && (
              <span className="text-[10px] text-amber-400 animate-pulse">
                Reconnecting...
              </span>
            )}
            <span className="text-sm tabular-nums text-muted-foreground">
              Tick #{state.tickCount}
            </span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                state.isRunning
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-muted-foreground/30"
              )}
            />
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[260px_1fr_300px] min-h-0">
        {/* ── Left: Agent Cards ──────────────────────────── */}
        <aside className="border-r border-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Agents
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {state.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() =>
                    setSelectedAgent((prev) =>
                      prev === agent.id ? null : agent.id
                    )
                  }
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-all hover:bg-accent/50 cursor-pointer",
                    selectedAgent === agent.id
                      ? "border-primary/40 bg-accent/30"
                      : "border-border",
                    agent.isFlagged && "border-red-500/40 bg-red-500/5",
                    repFlash[agent.id] === "up" &&
                      "ring-1 ring-emerald-500/50 bg-emerald-500/5",
                    repFlash[agent.id] === "down" &&
                      "ring-1 ring-red-500/50 bg-red-500/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          statusDot(agent.status)
                        )}
                      />
                      <span className="font-medium text-sm truncate">
                        {agent.name}
                      </span>
                    </div>
                    {agent.isFlagged && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] px-1 py-0 h-4 animate-pulse"
                      >
                        FLAGGED
                      </Badge>
                    )}
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mb-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-700",
                        repBarColor(agent.reputationScore)
                      )}
                      style={{
                        width: `${agent.reputationScore / 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className={repColor(agent.reputationScore, agent.isFlagged)}>
                      {agent.reputationScore.toLocaleString()}
                    </span>
                    <div className="flex gap-2 text-muted-foreground">
                      <span title="Completed">{agent.tasksCompleted}✓</span>
                      <span title="Failed">{agent.tasksFailed}✗</span>
                      <span title="Abandoned">{agent.tasksAbandoned}⊘</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Center: Task Board or Detail ────────────────── */}
        <main className="flex flex-col min-h-0 overflow-hidden">
          {detail ? (
            <AgentDetail
              agent={detail}
              history={detailHistory}
              tasks={detailTasks}
              onClose={() => setSelectedAgent(null)}
            />
          ) : (
            <TaskBoard
              open={openTasks}
              assigned={assignedTasks}
              completed={completedTasks}
              agents={state.agents}
            />
          )}
        </main>

        {/* ── Right: Event Feed ──────────────────────────── */}
        <aside className="border-l border-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Live Feed
            </h2>
          </div>
          <ScrollArea className="flex-1" ref={feedRef}>
            <div className="p-3 space-y-1">
              {state.events.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">
                  No events yet...
                </p>
              )}
              {[...state.events].reverse().map((event, i) => (
                <div
                  key={`${event.timestamp}-${i}`}
                  className={cn(
                    "border-l-2 pl-3 py-1.5",
                    eventColor(event.type)
                  )}
                >
                  <p className="text-[13px] text-foreground/85 leading-snug">
                    {event.message}
                  </p>
                  {event.reasoning && (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5 leading-snug">
                      &ldquo;{event.reasoning}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.txSignature && (
                      <a
                        href={txLink(event.txSignature)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        tx:{event.txSignature.slice(0, 8)}...
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

// ── Task Board ─────────────────────────────────────────────────────────

function TaskBoard({
  open,
  assigned,
  completed,
  agents,
}: {
  open: Task[];
  assigned: Task[];
  completed: Task[];
  agents: Agent[];
}) {
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <div className="grid grid-cols-3 h-full divide-x divide-border">
      <TaskColumn
        title="Open"
        count={open.length}
        accent="text-zinc-400"
      >
        {open.map((t) => (
          <TaskCard key={t.id} task={t} agentMap={agentMap} />
        ))}
      </TaskColumn>
      <TaskColumn
        title="In Progress"
        count={assigned.length}
        accent="text-sky-400"
      >
        {assigned.map((t) => (
          <TaskCard key={t.id} task={t} agentMap={agentMap} />
        ))}
      </TaskColumn>
      <TaskColumn
        title="Completed"
        count={completed.length}
        accent="text-emerald-400"
      >
        {completed.map((t) => (
          <TaskCard key={t.id} task={t} agentMap={agentMap} />
        ))}
      </TaskColumn>
    </div>
  );
}

function TaskColumn({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h3
          className={cn(
            "text-[11px] uppercase tracking-[0.15em] font-medium",
            accent
          )}
        >
          {title}
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {React.Children.count(children) === 0 && (
            <p className="text-xs text-muted-foreground/50 italic text-center py-4">
              —
            </p>
          )}
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function TaskCard({
  task,
  agentMap,
}: {
  task: Task;
  agentMap: Record<string, Agent>;
}) {
  const agent = task.assignee ? agentMap[task.assignee] : null;
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm transition-all hover:bg-accent/20">
      <p className="text-foreground/90 leading-snug text-[13px] mb-2 line-clamp-2">
        {task.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {agent && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
              {agent.name}
            </span>
          )}
          {outcomeBadge(task.outcome)}
        </div>
        {task.txSignature && (
          <a
            href={txLink(task.txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-sky-400/70 hover:text-sky-400 hover:underline"
          >
            on-chain
          </a>
        )}
      </div>
    </div>
  );
}

// ── Agent Detail View ──────────────────────────────────────────────────

function AgentDetail({
  agent,
  history,
  tasks,
  onClose,
}: {
  agent: Agent;
  history: { tick: number; score: number }[];
  tasks: Task[];
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn("h-3 w-3 rounded-full", statusDot(agent.status))}
          />
          <h2 className="font-heading font-semibold text-lg">{agent.name}</h2>
          <Badge variant="outline" className="text-[10px]">
            {agent.profileType}
          </Badge>
          {agent.isFlagged && (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              FLAGGED
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
          Back to Board
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4">
            <StatBox
              label="Reputation"
              value={agent.reputationScore.toLocaleString()}
              sub="/ 10,000"
              className={repColor(agent.reputationScore, agent.isFlagged)}
            />
            <StatBox
              label="Completed"
              value={String(agent.tasksCompleted)}
              className="text-emerald-400"
            />
            <StatBox
              label="Failed"
              value={String(agent.tasksFailed)}
              className="text-red-400"
            />
            <StatBox
              label="Abandoned"
              value={String(agent.tasksAbandoned)}
              className="text-amber-400"
            />
          </div>

          {/* Reputation Bar (large) */}
          <div>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-700",
                  repBarColor(agent.reputationScore)
                )}
                style={{ width: `${agent.reputationScore / 100}%` }}
              />
            </div>
          </div>

          {/* Reputation History Chart (simple SVG sparkline) */}
          {history.length > 1 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
                Reputation History
              </h3>
              <ReputationChart data={history} />
            </div>
          )}

          {/* On-chain link */}
          {agent.publicKey && (
            <div className="text-xs text-muted-foreground">
              On-chain:{" "}
              <a
                href={`https://explorer.solana.com/address/${agent.publicKey}?cluster=custom&customUrl=http://localhost:8899`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline"
              >
                {agent.publicKey.slice(0, 12)}...
              </a>
            </div>
          )}

          <Separator />

          {/* Task Log */}
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
              Task History
            </h3>
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No tasks yet.
              </p>
            )}
            <div className="space-y-1.5">
              {tasks
                .slice()
                .reverse()
                .slice(0, 20)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between text-sm border border-border rounded px-3 py-2"
                  >
                    <span className="text-foreground/80 truncate max-w-[60%] text-[13px]">
                      {task.description}
                    </span>
                    <div className="flex items-center gap-2">
                      {outcomeBadge(task.outcome)}
                      {task.txSignature && (
                        <a
                          href={txLink(task.txSignature)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-400/70 hover:underline"
                        >
                          tx
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className={cn("text-2xl font-heading font-bold tabular-nums", className)}>
        {value}
        {sub && (
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}

// ── Simple SVG Sparkline Chart ─────────────────────────────────────────

function ReputationChart({
  data,
}: {
  data: { tick: number; score: number }[];
}) {
  const W = 600;
  const H = 100;
  const PAD = 8;

  if (data.length < 2) return null;

  const minY = Math.min(...data.map((d) => d.score)) - 200;
  const maxY = Math.max(...data.map((d) => d.score)) + 200;
  const rangeY = maxY - minY || 1;

  const points = data.map((d, i) => {
    const x = PAD + ((W - 2 * PAD) * i) / (data.length - 1);
    const y = H - PAD - ((d.score - minY) / rangeY) * (H - 2 * PAD);
    return `${x},${y}`;
  });

  const lastScore = data[data.length - 1].score;
  const lineColor =
    lastScore >= 7000
      ? "#34d399"
      : lastScore >= 4000
        ? "#fbbf24"
        : "#f87171";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-24 rounded border border-border bg-card"
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* endpoint dot */}
      {(() => {
        const last = points[points.length - 1].split(",");
        return (
          <circle cx={last[0]} cy={last[1]} r="3" fill={lineColor} />
        );
      })()}
    </svg>
  );
}
