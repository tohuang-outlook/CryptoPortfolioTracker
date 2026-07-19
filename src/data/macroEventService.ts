import type { MacroEventRisk } from "../types/forecast.js";

// Official 2026 FOMC and scheduled U.S. CPI / employment-release dates.
const EVENTS = [
  ["CPI release", "2026-08-12"], ["Employment situation", "2026-08-07"], ["FOMC decision", "2026-07-29"],
  ["FOMC decision", "2026-09-16"], ["FOMC decision", "2026-10-28"], ["FOMC decision", "2026-12-09"],
  ["CPI release", "2026-09-11"], ["CPI release", "2026-10-14"], ["CPI release", "2026-11-10"], ["CPI release", "2026-12-10"]
] as const;

export function getMacroEventRisk(asOfDate: string): MacroEventRisk | null {
  const current = Date.parse(`${asOfDate}T00:00:00Z`);
  const next = EVENTS
    .map(([eventName, eventDate]) => ({ eventName, eventDate, daysUntil: Math.round((Date.parse(`${eventDate}T00:00:00Z`) - current) / 86_400_000) }))
    .filter((event) => event.daysUntil >= 0 && event.daysUntil <= 3)
    .sort((left, right) => left.daysUntil - right.daysUntil)[0];
  if (!next) return null;
  return { ...next, confidencePenalty: next.daysUntil === 0 ? 14 : next.daysUntil === 1 ? 10 : 6, rangeMultiplier: next.daysUntil === 0 ? 1.32 : next.daysUntil === 1 ? 1.22 : 1.12 };
}
