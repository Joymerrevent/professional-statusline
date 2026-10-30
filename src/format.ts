import { GREEN, RED, YELLOW } from "./ansi.ts";

// Remaining percentage -> color. More is better: >= 50 green, >= 20 yellow, otherwise red.
export function colorForRemaining(percent: number): string {
  if (percent >= 50) return GREEN;
  if (percent >= 20) return YELLOW;
  return RED;
}

// Remaining percentage from a used percentage, rounded and clamped to 0..100.
export function remainingFromUsed(usedPercent: number): number {
  return clampPercent(100 - Math.round(usedPercent));
}

export function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

// Time left until an epoch-seconds moment: "3d4h" / "1h21m" / "45m". Empty once the moment has passed.
export function formatUntil(resetAtSec: number, nowSec: number): string {
  const left = Math.floor(resetAtSec - nowSec);
  if (left <= 0) return "";
  if (left >= 86400)
    return `${Math.floor(left / 86400)}d${Math.floor((left % 86400) / 3600)}h`;
  if (left >= 3600)
    return `${Math.floor(left / 3600)}h${Math.floor((left % 3600) / 60)}m`;
  return `${Math.ceil(left / 60)}m`;
}

// Month/day of an epoch-seconds moment in the local time zone, such as "11/1".
export function formatMonthDay(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Money: "$1,059.85" for USD, "EUR 1,059.85" for other currencies.
export function formatMoney(
  amount: number,
  currency = "USD",
  decimals = 2,
): string {
  const digits = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return currency === "USD" ? `$${digits}` : `${currency} ${digits}`;
}
