// Jev × obniz LED: Physical AI Hello World.
//   one line of text → Jev (one call, three typed questions) → 15 LEDs
//
//   npm start                      interactive: type a message, watch the strip
//   npm start -- "本番でエラー"     one-shot
//   npm start -- --rule            keyword baseline instead of Jev
//   npm start -- --dry-run         no obniz; the strip is printed as text

import "./env.js";
import { appendFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { DecisionProvider } from "./decision.js";
import { createJevProvider } from "./jev.js";
import { createRuleProvider } from "./rule.js";
import { ascii, createLedStrip, type Frame } from "./led.js";
import { render } from "./render.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const useRule = args.includes("--rule");
const oneShot = args.filter((a) => !a.startsWith("--")).join(" ");

const provider: DecisionProvider = useRule ? createRuleProvider() : createJevProvider();
const strip = createLedStrip(dryRun);
const LOG_FILE = fileURLToPath(new URL("../logs/decisions.jsonl", import.meta.url));

async function handle(message: string): Promise<Frame | undefined> {
  const t0 = performance.now();
  let decided: Awaited<ReturnType<DecisionProvider["decide"]>>;
  try {
    decided = await provider.decide(message);
  } catch (err) {
    // Timeout, rate limit, auth error: keep whatever the strip is showing (HOLD) and say why.
    console.error(`  ${provider.name} error → HOLD: ${err instanceof Error ? err.message : err}`);
    return undefined;
  }
  const t1 = performance.now();

  const frame = render(decided.decision);
  await strip.show(frame);
  const t2 = performance.now();

  const d = decided.decision;
  console.log(
    `  signal=${d.signal} (conf ${d.confidence.toFixed(2)})  severity=${d.severity.toFixed(1)}/4  needs_reply=${d.needsReply.toFixed(2)}` +
      `  | ${provider.name} ${Math.round(t1 - t0)}ms  led ${Math.round(t2 - t1)}ms`,
  );
  console.log(`  ${ascii(frame)}`);

  await appendFile(
    LOG_FILE,
    JSON.stringify({
      ts: new Date().toISOString(),
      provider: provider.name,
      message,
      decision: d,
      decide_ms: Math.round(t1 - t0),
      led_ms: Math.round(t2 - t1),
      raw: decided.raw,
    }) + "\n",
  );
  return frame;
}

async function main(): Promise<void> {
  await mkdir(new URL("../logs/", import.meta.url), { recursive: true });

  if (oneShot) {
    // Leave the result on the strip; blink for a moment first so it can be seen.
    const frame = await handle(oneShot);
    if (frame?.blink) await new Promise((r) => setTimeout(r, 3000));
    await strip.freeze();
    process.exit(0);
  }

  const tty = Boolean(process.stdin.isTTY);
  if (tty) console.log(`provider=${provider.name}${dryRun ? " (dry-run)" : ""}  — type a message, Enter to decide, Ctrl-C to quit`);
  const rl = createInterface({ input: process.stdin, output: tty ? process.stdout : undefined, terminal: tty });
  rl.setPrompt("> ");
  rl.prompt();
  // Lines are handled one at a time, so piped input (a scenario file) runs sequentially too.
  for await (const line of rl) {
    const message = line.trim();
    if (message) {
      if (!tty) console.log(`> ${message}`);
      await handle(message);
    }
    rl.prompt();
  }
  await shutdown();
}

async function shutdown(): Promise<void> {
  await strip.off().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
