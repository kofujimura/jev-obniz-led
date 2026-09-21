// What every decision provider (Jev, keyword rule, ...) must return.
// render.ts turns this into LEDs, so providers stay interchangeable.

export type Signal = "fine" | "caution" | "alert";

export interface Decision {
  /** Which light to show. */
  signal: Signal;
  /** 0..1: how sure the provider is about `signal`. Drives brightness. */
  confidence: number;
  /** 0..4: how serious the situation is. Drives how many LEDs light up. */
  severity: number;
  /** 0..1: probability that the sender is waiting for a reply. Drives blinking. */
  needsReply: number;
}

export interface DecisionProvider {
  name: string;
  decide(message: string): Promise<{ decision: Decision; raw: unknown }>;
}
