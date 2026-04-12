/**
 * Canonical model family identifiers used across the DiriRouter system.
 *
 * Families are provider-agnostic. A family groups model variants that share
 * the same capability profile and are meant to be interchangeable in routing.
 *
 * Examples:
 *   - `claude-opus`     → Opus-line models (claude-3-opus, claude-4-opus, ...)
 *   - `claude-sonnet`   → Sonnet-line models
 *   - `claude-haiku`     → Haiku-line models
 *   - `gemini-pro`       → Gemini Pro-line models
 *   - `gemini-flash`     → Gemini Flash-line models
 *   - `gpt-reasoning`    → o-series + reasoning-optimized GPT models
 *   - `gpt-standard`     → Standard GPT-4-line models
 *   - `gpt-mini`         → Mini/budget GPT models
 *   - `gpt-nano`         → Nano/nano budget GPT models
 */
export type ModelFamily =
  | "claude-opus"
  | "claude-sonnet"
  | "claude-haiku"
  | "gemini-pro"
  | "gemini-flash"
  | "gemini-flash-lite"
  | "gpt-reasoning"
  | "gpt-standard"
  | "gpt-mini"
  | "gpt-nano";

/**
 * Stability of a model variant.
 *
 * - `stable`: publicly available, production-ready model.
 * - `preview`: early-access, preview, or experimental model variant.
 */
export type ModelStability = "stable" | "preview";
