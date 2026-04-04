/**
 * Playground model toggle state manager.
 *
 * Reads and writes `playground-state.json` alongside `.env` in the process
 * working directory. The file tracks which models have been disabled by the
 * user via the playground UI.
 *
 * Schema:
 * ```json
 * {
 *   "disabledModels": ["model-a", "model-b"],
 *   "lastUpdated": "2026-04-04T12:00:00.000Z"
 * }
 * ```
 *
 * If the file is missing or malformed, `disabledModels` defaults to `[]`
 * (all models enabled).
 *
 * @module playground/model-state
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Persisted shape of `playground-state.json`.
 */
export interface PlaygroundState {
  /** Model IDs that have been explicitly disabled. */
  disabledModels: string[];
  /** ISO-8601 timestamp of the last write. */
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the absolute path to `playground-state.json` in the cwd.
 * Kept as a function so tests can override `process.cwd()` via spies.
 */
function stateFilePath(): string {
  return join(process.cwd(), "playground-state.json");
}

/**
 * Returns `true` if `value` is a plain object (not an array, not null).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that a parsed value conforms to {@link PlaygroundState}.
 *
 * Accepts partial files: missing/invalid fields are normalised rather than
 * rejected, so a file with only `disabledModels` is still usable.
 */
function isValidState(value: unknown): value is PlaygroundState {
  if (!isPlainObject(value)) return false;
  if (!Array.isArray(value.disabledModels)) return false;
  if (!value.disabledModels.every((m) => typeof m === "string")) return false;
  if (typeof value.lastUpdated !== "string") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads `playground-state.json` from the cwd.
 *
 * Returns a normalised {@link PlaygroundState} in all cases:
 * - If the file doesn't exist → `{ disabledModels: [], lastUpdated: "" }`
 * - If the file is malformed → same default
 * - If the file is valid but missing `lastUpdated` → treats it as `""`
 *
 * @returns The current playground state.
 */
export function readPlaygroundState(): PlaygroundState {
  const defaultState: PlaygroundState = { disabledModels: [], lastUpdated: "" };

  let raw: string;
  try {
    raw = readFileSync(stateFilePath(), "utf-8");
  } catch {
    // File doesn't exist or isn't readable — treat all models as enabled.
    return defaultState;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — fall back to default.
    return defaultState;
  }

  if (!isValidState(parsed)) {
    // Wrong shape — fall back to default.
    return defaultState;
  }

  return parsed;
}

/**
 * Writes a {@link PlaygroundState} object to `playground-state.json` in the
 * cwd, overwriting any existing file.
 *
 * Throws if the file system write fails (e.g. permissions issue).
 *
 * @param state - The state to persist.
 */
export function writePlaygroundState(state: PlaygroundState): void {
  const json = JSON.stringify(state, null, 2);
  writeFileSync(stateFilePath(), json, "utf-8");
}

/**
 * Toggles a model's disabled status.
 *
 * - If `modelId` is currently in `disabledModels`, it is **removed** (re-enabled).
 * - If `modelId` is not in `disabledModels`, it is **added** (disabled).
 *
 * `lastUpdated` is always set to the current UTC timestamp before writing.
 *
 * @param modelId - The model identifier to toggle.
 * @returns The updated {@link PlaygroundState} after the write.
 */
export function toggleModel(modelId: string): PlaygroundState {
  const current = readPlaygroundState();

  const isDisabled = current.disabledModels.includes(modelId);
  const disabledModels = isDisabled
    ? current.disabledModels.filter((id) => id !== modelId)
    : [...current.disabledModels, modelId];

  const next: PlaygroundState = {
    disabledModels,
    lastUpdated: new Date().toISOString(),
  };

  writePlaygroundState(next);
  return next;
}

/**
 * Convenience helper: returns `true` if the given model is **enabled**
 * (i.e. not in `disabledModels`).
 *
 * Reads the state fresh on every call — no caching.
 *
 * @param modelId - The model identifier to check.
 * @returns `true` if the model is enabled, `false` if it is disabled.
 */
export function isModelEnabled(modelId: string): boolean {
  const { disabledModels } = readPlaygroundState();
  return !disabledModels.includes(modelId);
}
