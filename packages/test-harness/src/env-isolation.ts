/**
 * Manages environment variable isolation for tests.
 * Saves the current state of process.env and restores it after tests.
 *
 * @example
 * ```ts
 * describe("my test", () => {
 *   const env = new EnvIsolation();
 *
 *   beforeEach(() => {
 *     env.save();
 *   });
 *
 *   afterEach(() => {
 *     env.restore();
 *   });
 *
 *   it("modifies env", () => {
 *     process.env.MY_VAR = "test-value";
 *     // Test code...
 *   });
 * });
 * ```
 */
export class EnvIsolation {
  private savedEnv: Record<string, string | undefined> | null = null;

  /**
   * Saves the current state of process.env.
   * Must be called before any modifications.
   */
  save(): void {
    // Deep copy all current env vars
    this.savedEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      this.savedEnv[key] = value;
    }
  }

  /**
   * Restores process.env to its previously saved state.
   * Removes any added variables, restores modified values, and re-adds deleted ones.
   * Safe to call multiple times (idempotent).
   */
  restore(): void {
    if (this.savedEnv === null) {
      return;
    }

    const currentKeys = new Set(Object.keys(process.env));
    const savedKeys = new Set(Object.keys(this.savedEnv));

    for (const key of currentKeys) {
      if (!savedKeys.has(key)) {
        Reflect.deleteProperty(process.env, key);
      }
    }

    for (const [key, value] of Object.entries(this.savedEnv)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }

    this.savedEnv = null;
  }

  /**
   * Sets an environment variable for the duration of the test.
   * Automatically restored when restore() is called.
   *
   * @param key - The environment variable name
   * @param value - The value to set
   */
  set(key: string, value: string): void {
    process.env[key] = value;
  }

  /**
   * Deletes an environment variable for the duration of the test.
   * Automatically restored when restore() is called.
   *
   * @param key - The environment variable name
   */
  delete(key: string): void {
    Reflect.deleteProperty(process.env, key);
  }

  /**
   * Clears all environment variables.
   * Use with caution - restores to empty state when restore() is called.
   */
  clear(): void {
    for (const key of Object.keys(process.env)) {
      Reflect.deleteProperty(process.env, key);
    }
  }
}
