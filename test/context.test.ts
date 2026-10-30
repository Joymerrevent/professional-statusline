// node:test's test() returns a promise that the test runner itself awaits.
/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { contextRemaining, lastUsageTokens } from "../src/context.ts";
import { tempDir } from "./helpers.ts";

const dir = tempDir();
const usageLine = (input: number, output: number) =>
  JSON.stringify({
    type: "assistant",
    message: {
      usage: {
        input_tokens: input,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 0,
        output_tokens: output,
      },
    },
  });

test("the values Claude Code sends win over the transcript", () => {
  assert.equal(
    contextRemaining({ context_window: { remaining_percentage: 64.6 } }),
    65,
  );
  assert.equal(
    contextRemaining({
      context_window: { remaining_percentage: null, used_percentage: 30 },
    }),
    70,
  );
});

test("without values, the last usage record in the transcript gives the estimate", () => {
  const path = join(dir, "t1.jsonl");
  writeFileSync(
    path,
    [
      usageLine(10_000, 500),
      JSON.stringify({ type: "user" }),
      usageLine(99_000, 0),
      "",
    ].join("\n"),
  );
  assert.equal(lastUsageTokens(path), 100_000);
  assert.equal(contextRemaining({ transcript_path: path }), 50);
  assert.equal(
    contextRemaining({
      transcript_path: path,
      context_window: { context_window_size: 1_000_000 },
    }),
    90,
  );
});

test("a cut line at the start of the read window is skipped", () => {
  const path = join(dir, "t2.jsonl");
  writeFileSync(
    path,
    `{"message":{"usage":{"input_tokens":5\n${usageLine(19_000, 0)}\n{"broken`,
  );
  assert.equal(lastUsageTokens(path), 20_000);
});

test("a missing transcript or one without usage gives no estimate", () => {
  assert.equal(
    contextRemaining({ transcript_path: join(dir, "missing.jsonl") }),
    undefined,
  );
  const path = join(dir, "t3.jsonl");
  writeFileSync(path, `${JSON.stringify({ type: "user" })}\n`);
  assert.equal(contextRemaining({ transcript_path: path }), undefined);
  assert.equal(contextRemaining({}), undefined);
});
