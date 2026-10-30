import assert from "node:assert/strict";
import { test } from "node:test";
import { GREEN, RED, YELLOW } from "../src/ansi.ts";
import { nextMonthlyReset } from "../src/enterprise.ts";
import {
  colorForRemaining,
  formatMoney,
  formatUntil,
  remainingFromUsed,
} from "../src/format.ts";

test("formatUntil picks days, hours, or minutes", () => {
  assert.equal(formatUntil(1000 + 3 * 86400 + 4 * 3600 + 59, 1000), "3d4h");
  assert.equal(formatUntil(1000 + 86400, 1000), "1d0h");
  assert.equal(formatUntil(1000 + 3600 + 21 * 60, 1000), "1h21m");
  assert.equal(formatUntil(1000 + 3599, 1000), "60m");
  assert.equal(formatUntil(1000 + 61, 1000), "2m");
  assert.equal(formatUntil(1000 + 1, 1000), "1m");
});

test("formatUntil is empty once the moment has passed", () => {
  assert.equal(formatUntil(1000, 1000), "");
  assert.equal(formatUntil(999, 1000), "");
});

test("colorForRemaining uses green, yellow, red at 50 and 20", () => {
  assert.equal(colorForRemaining(100), GREEN);
  assert.equal(colorForRemaining(50), GREEN);
  assert.equal(colorForRemaining(49), YELLOW);
  assert.equal(colorForRemaining(20), YELLOW);
  assert.equal(colorForRemaining(19), RED);
  assert.equal(colorForRemaining(0), RED);
});

test("remainingFromUsed rounds and stays within 0..100", () => {
  assert.equal(remainingFromUsed(14.4), 86);
  assert.equal(remainingFromUsed(0), 100);
  assert.equal(remainingFromUsed(130), 0);
  assert.equal(remainingFromUsed(-5), 100);
});

test("formatMoney groups thousands and keeps the decimals", () => {
  assert.equal(formatMoney(1059.85), "$1,059.85");
  assert.equal(formatMoney(500), "$500.00");
  assert.equal(formatMoney(1234.5, "EUR"), "EUR 1,234.50");
  assert.equal(formatMoney(12, "JPY", 0), "JPY 12");
});

test("nextMonthlyReset is 00:00 UTC on the first of next month, including December", () => {
  assert.equal(
    nextMonthlyReset(Date.UTC(2026, 9, 30, 12) / 1000),
    Date.UTC(2026, 10, 1) / 1000,
  );
  assert.equal(
    nextMonthlyReset(Date.UTC(2026, 11, 31, 23, 59) / 1000),
    Date.UTC(2027, 0, 1) / 1000,
  );
  assert.equal(
    nextMonthlyReset(Date.UTC(2026, 10, 1, 0, 0) / 1000),
    Date.UTC(2026, 11, 1) / 1000,
  );
});
