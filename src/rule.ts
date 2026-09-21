// Keyword baseline: what a diligent engineer writes in an afternoon, for comparison with Jev.
// It cannot read negation ("緊急ではない") or paraphrase; that gap is the point of the demo.

import type { DecisionProvider, Signal } from "./decision.js";

const ALERT = ["緊急", "至急", "エラー", "障害", "落ち", "ダウン", "urgent", "asap", "error", "down", "outage"];
const CAUTION = ["遅れ", "確認", "今日中", "明日まで", "注意", "相談", "delay", "soon", "reminder"];
const REPLY = ["?", "？", "返事", "返信", "教えて", "どう", "reply", "let me know"];

const SEVERITY: Record<Signal, number> = { fine: 0, caution: 2, alert: 4 };

export function createRuleProvider(): DecisionProvider {
  return {
    name: "rule",
    async decide(message) {
      const text = message.toLowerCase();
      const hit = (words: string[]) => words.filter((w) => text.includes(w));

      const alertHits = hit(ALERT);
      const cautionHits = hit(CAUTION);
      const replyHits = hit(REPLY);
      const signal: Signal = alertHits.length ? "alert" : cautionHits.length ? "caution" : "fine";

      return {
        decision: {
          signal,
          confidence: 1, // a rule is never in doubt, which is exactly its weakness
          severity: SEVERITY[signal],
          needsReply: replyHits.length ? 1 : 0,
        },
        raw: { alertHits, cautionHits, replyHits },
      };
    },
  };
}
