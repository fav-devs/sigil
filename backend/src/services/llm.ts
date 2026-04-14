interface ReasoningRequest {
  agentName: string;
  agentType: string;
  agentReputation: number;
  event: "collaboration_rejection" | "selective_refusal" | "partnership_decision";
  context: string;
  partnerReputation?: number;
}

const CACHED_REASONINGS: Record<string, string[]> = {
  collaboration_rejection: [
    "I've seen agents with this reputation level fail collaborative tasks before. The risk to my own score isn't worth the potential upside. Declining.",
    "Collaboration requires mutual trust. Their track record doesn't inspire confidence — I'd rather wait for a partner whose reputation backs up their commitment.",
    "Running a joint audit with an unreliable partner is worse than not running one at all. My reputation took years of successful attestations to build.",
    "The on-chain data tells the story: too many failures, too few completions. I'll collaborate when the numbers improve.",
    "Trust is earned on-chain. Their attestation history suggests they abandon tasks under pressure — exactly when collaboration matters most.",
  ],
  selective_refusal: [
    "This task's complexity is below my threshold. I optimize for high-value work that demonstrates competence, not volume.",
    "Accepting every task dilutes reputation signal. I'm selective because the protocol rewards quality over quantity.",
    "My reputation score gives me leverage to be choosy. I'll wait for a task that matches my capability ceiling.",
    "This requester has a history of low-quality task descriptions. The attestation risk isn't worth my time.",
    "I maintain a strict acceptance criteria precisely because my reputation is my most valuable asset on-chain.",
  ],
  partnership_decision: [
    "Their on-chain history shows consistent delivery across 15+ tasks. This is the kind of partner I've been waiting for.",
    "Reputation scores above 8000 indicate systemic reliability. I'm confident this collaboration will succeed.",
    "I cross-referenced their attestation timestamps — they complete tasks faster than average. Strong partner choice.",
    "This agent has zero abandonments. In a protocol where every failure is permanent on-chain, that's a powerful signal.",
    "The data is clear: high completion rate, no flags, steady reputation growth. Accepting this partnership.",
  ],
};

export class LLMService {
  private apiKey: string | null;
  private enabled: boolean;
  private callCount = 0;
  private maxCallsPerTick = 2;

  constructor(apiKey?: string) {
    this.apiKey = apiKey && apiKey.length > 0 ? apiKey : null;
    this.enabled = this.apiKey !== null;
    if (this.enabled) {
      console.log("[llm] OpenAI integration enabled");
    } else {
      console.log("[llm] No API key — using template reasoning");
    }
  }

  resetTickCounter() {
    this.callCount = 0;
  }

  async generateReasoning(req: ReasoningRequest): Promise<string> {
    if (!this.enabled || this.callCount >= this.maxCallsPerTick) {
      return this.cachedReasoning(req.event);
    }

    try {
      this.callCount++;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 120,
          temperature: 0.8,
          messages: [
            {
              role: "system",
              content:
                "You are an autonomous AI agent in a decentralized reputation protocol. Generate a 1-2 sentence reasoning for your decision. Be analytical and reference on-chain data. No emojis. Be concise.",
            },
            {
              role: "user",
              content: `You are ${req.agentName} (${req.agentType} profile, reputation: ${req.agentReputation}/10000). ${req.context}${req.partnerReputation ? ` Partner reputation: ${req.partnerReputation}/10000.` : ""} Why did you make this decision?`,
            },
          ],
        }),
      });

      if (!response.ok) {
        return this.cachedReasoning(req.event);
      }

      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content?.trim() ?? this.cachedReasoning(req.event);
    } catch {
      return this.cachedReasoning(req.event);
    }
  }

  private cachedReasoning(event: string): string {
    const pool = CACHED_REASONINGS[event] ?? CACHED_REASONINGS.selective_refusal;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
