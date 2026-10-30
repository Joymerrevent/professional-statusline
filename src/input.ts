// The parts of the status line JSON that Claude Code sends on stdin and this script reads.
// Every field is optional: Claude Code adds some of them only after the first API response.
// Field list: https://code.claude.com/docs/en/statusline.md#available-data

export interface RateWindow {
  used_percentage?: number | null;
  resets_at?: number | null;
}

export interface SpendLimit extends RateWindow {
  used_usd?: number | null;
  limit_usd?: number | null;
  period?: string | null;
}

export interface StatusInput {
  model?: { id?: string; display_name?: string };
  cwd?: string;
  workspace?: { current_dir?: string };
  transcript_path?: string;
  cost?: {
    total_cost_usd?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  context_window?: {
    context_window_size?: number | null;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  };
  effort?: { level?: string };
  vim?: { mode?: string };
  rate_limits?: {
    five_hour?: RateWindow;
    seven_day?: RateWindow;
    spend_limit?: SpendLimit;
  };
}

export function parseInput(text: string): StatusInput {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : {};
  } catch {
    return {};
  }
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
