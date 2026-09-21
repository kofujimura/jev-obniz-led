// Decision → LED frame. Each typed answer maps to one physical property of the strip:
//   signal (Choice)     → color
//   confidence          → brightness (an unsure model glows dimmer)
//   severity (Score)    → how many LEDs are lit
//   needsReply (Noul)   → blink

import type { Decision, Signal } from "./decision.js";
import { BLACK, LED_COUNT, MAX_BRIGHTNESS, MIN_BRIGHTNESS, type Frame, type RGB } from "./led.js";
import { SEVERITY_LEVELS } from "./jev.js";

const COLOR: Record<Signal, RGB> = {
  fine: [0, 1, 0],
  caution: [1, 1, 0],
  alert: [1, 0, 0],
};

export const REPLY_THRESHOLD = 0.5;

export function render(d: Decision): Frame {
  const brightness = Math.round(MIN_BRIGHTNESS + (MAX_BRIGHTNESS - MIN_BRIGHTNESS) * clamp01(d.confidence));
  const color = COLOR[d.signal].map((c) => c * brightness) as RGB;

  const lit = Math.max(1, Math.round((clamp01(d.severity / SEVERITY_LEVELS)) * LED_COUNT));
  const colors = Array.from({ length: LED_COUNT }, (_, i) => (i < lit ? color : BLACK));

  const blink = d.needsReply > REPLY_THRESHOLD;
  return {
    colors,
    blink,
    label: `${d.signal} ${lit}/${LED_COUNT} brightness=${brightness}`,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
