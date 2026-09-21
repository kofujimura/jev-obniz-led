// WS2812B LED strip on an M5 Atom Lite (ObnizOS), driven through the obniz cloud HTTP API.
// SPI encoding and HTTP transport are ported from https://github.com/kofujimura/obniz-led-skill (src/obniz.ts).

export type RGB = [number, number, number];

export const LED_COUNT = parseInt(process.env.LED_COUNT ?? "15", 10);
export const MAX_BRIGHTNESS = 0x66; // keep WS2812B current low; do not exceed
export const MIN_BRIGHTNESS = 0x20; // dim but still visible

const OBNIZ_ID = process.env.OBNIZ_ID ?? "";
const ACCESS_TOKEN = process.env.OBNIZ_ACCESS_TOKEN;
const DIN_PIN = 26; // M5 Atom Lite GPIO26
const API_URL = `https://obniz.io/obniz/${OBNIZ_ID}/api/1`;

export const BLACK: RGB = [0, 0, 0];

// Each WS2812B bit becomes a nibble (0-bit=0x8, 1-bit=0xe); two bits per SPI byte, GRB order.
function spiFromByte(val: number): number[] {
  const zero = 0x8, one = 0xe, out: number[] = [];
  for (let i = 0; i < 8; i += 2) {
    const hi = (val & (0x80 >> i)) ? one : zero;
    const lo = (val & (0x80 >> (i + 1))) ? one : zero;
    out.push((hi << 4) | lo);
  }
  return out;
}

function rgbsToSpiBytes(colors: RGB[]): number[] {
  return colors.flatMap(([r, g, b]) => [...spiFromByte(g), ...spiFromByte(r), ...spiFromByte(b)]);
}

async function postLeds(colors: RGB[]): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ACCESS_TOKEN) headers["authorization"] = `Bearer ${ACCESS_TOKEN}`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify([
      { [`io${DIN_PIN}`]: { output_type: "push-pull5v" } },
      { [`io${DIN_PIN}`]: { pull_type: "float" } },
      { spi0: { mode: "master", clock: 3330000, mosi: DIN_PIN } },
      { spi0: { data: rgbsToSpiBytes(colors), read: false } },
    ]),
  });
  if (!res.ok) throw new Error(`obniz API error: ${res.status} ${res.statusText}`);
}

/** One picture of the strip: what to light, and whether to keep blinking it. */
export interface Frame {
  colors: RGB[];
  blink: boolean;
  label: string;
}

export interface LedStrip {
  show(frame: Frame): Promise<void>;
  /** Stop blinking and leave the current frame lit (used when the process exits after a one-shot). */
  freeze(): Promise<void>;
  off(): Promise<void>;
}

export function ascii(frame: Frame): string {
  const cells = frame.colors.map(([r, g, b]) => (r + g + b > 0 ? "■" : "·")).join("");
  return `[${cells}] ${frame.label}${frame.blink ? " blink" : ""}`;
}

const BLINK_INTERVAL_MS = 500;

/** With dryRun, nothing is sent to obniz; the caller prints ascii(frame) instead. */
export function createLedStrip(dryRun: boolean): LedStrip {
  if (!dryRun && !OBNIZ_ID) {
    throw new Error("OBNIZ_ID is not set (put it in .env.local or run with --dry-run)");
  }

  const send = dryRun ? async () => {} : postLeds;
  const dark = Array<RGB>(LED_COUNT).fill(BLACK);
  let current: RGB[] = dark;
  let blinkTimer: NodeJS.Timeout | undefined;

  const stopBlink = () => {
    if (blinkTimer) clearInterval(blinkTimer);
    blinkTimer = undefined;
  };

  return {
    async show(frame) {
      stopBlink();
      current = frame.colors;
      await send(current);
      if (!frame.blink) return;
      let on = true;
      blinkTimer = setInterval(() => {
        on = !on;
        send(on ? frame.colors : dark).catch(() => {});
      }, BLINK_INTERVAL_MS);
    },
    async freeze() {
      if (!blinkTimer) return;
      stopBlink();
      await send(current);
    },
    async off() {
      stopBlink();
      current = dark;
      await send(dark);
    },
  };
}
