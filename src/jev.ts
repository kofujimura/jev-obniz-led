// Jev (TypeSafe System One) provider: one API call, three typed questions.
// This file is the one to edit when you want the light to mean something else.

import { TypeSafeClient, choice, noul, score } from "@typesafe-ai/sdk";
import type { DecisionProvider } from "./decision.js";

// Instructions are in English (Jev's primary training language); the message itself can be Japanese.
// Every question names the `message` field so Jev reads exactly that part of the state.
export const questions = {
  signal: choice(
    "The `message` was sent to the reader. Which signal should the reader's status light show for it?",
    {
      fine: "Good news, routine information, or nothing the reader needs to act on or worry about",
      caution: "Something the reader should keep an eye on or deal with soon, but not an emergency",
      alert: "A problem or emergency that needs the reader's immediate attention",
    },
  ),
  severity: score("How serious is the situation described in the `message` for the reader?", [
    "No problem at all",
    "Minor inconvenience",
    "Moderate problem that needs handling",
    "Serious problem",
    "Critical emergency",
  ]),
  needs_reply: noul("The sender of the `message` is asking the reader to reply or respond"),
};

export const SEVERITY_LEVELS = 4; // score ranges 0..4 (five rubric entries above)

export function createJevProvider(): DecisionProvider {
  const client = new TypeSafeClient({ timeout: 5000 }); // reads TYPESAFE_API_KEY, defaults to jev-latest

  return {
    name: "jev",
    async decide(message) {
      const result = await client.systemOne({ state: { message }, questions });
      const { signal, severity, needs_reply } = result.answers;
      return {
        decision: {
          signal: signal.choice,
          confidence: signal.confidence,
          severity: severity.score,
          needsReply: needs_reply.noul,
        },
        raw: result,
      };
    },
  };
}
