import { randomUUID } from "crypto";

/**
 * Generate a unique turn ID using UUID v4 format.
 * Each turn represents one complete user input → result cycle.
 *
 * @returns A unique turn identifier in the format `turn_<uuid>`
 */
export function generateTurnId(): string {
  return `turn_${randomUUID()}`;
}
