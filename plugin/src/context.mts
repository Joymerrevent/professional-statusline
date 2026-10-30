import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { clampPercent, remainingFromUsed } from "./format.mts";
import { num, type StatusInput } from "./input.mts";

const DEFAULT_WINDOW = 200_000;
// Read only the end of the transcript. The last usage record is near the end, and transcripts grow large.
const TAIL_BYTES = 256 * 1024;

interface Usage {
  input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens?: number;
}

// Tokens in the context window according to the last usage record in the transcript. 0 when none is found.
export function lastUsageTokens(transcriptPath: string): number {
  let text: string;
  try {
    const fd = openSync(transcriptPath, "r");
    try {
      const size = fstatSync(fd).size;
      const length = Math.min(size, TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, size - length);
      text = buffer.toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return 0;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || !line.includes('"usage"')) continue;
    try {
      const usage = (JSON.parse(line) as { message?: { usage?: Usage } })
        .message?.usage;
      if (!usage) continue;
      return (
        (num(usage.input_tokens) ?? 0) +
        (num(usage.cache_read_input_tokens) ?? 0) +
        (num(usage.cache_creation_input_tokens) ?? 0) +
        (num(usage.output_tokens) ?? 0)
      );
    } catch {
      // The first line of the tail can be cut in the middle. Skip lines that don't parse.
    }
  }
  return 0;
}

// Remaining context in percent. Prefers the values Claude Code sends, then estimates from the transcript.
// Undefined before the first API response, when nothing is known yet.
export function contextRemaining(input: StatusInput): number | undefined {
  const cw = input.context_window;
  const remaining = num(cw?.remaining_percentage);
  if (remaining !== undefined) return clampPercent(remaining);
  const used = num(cw?.used_percentage);
  if (used !== undefined) return remainingFromUsed(used);

  const transcript = input.transcript_path;
  if (!transcript) return undefined;
  const tokens = lastUsageTokens(transcript);
  if (tokens <= 0) return undefined;
  const window = num(cw?.context_window_size) ?? DEFAULT_WINDOW;
  return clampPercent(100 - (tokens * 100) / window);
}
