import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Manages a temporary directory for test isolation with automatic cleanup.
 *
 * @example
 * ```ts
 * describe("my test", () => {
 *   const tempDir = new TempDir();
 *
 *   beforeEach(async () => {
 *     await tempDir.setup();
 *   });
 *
 *   afterEach(async () => {
 *     await tempDir.cleanup();
 *   });
 *
 *   it("uses temp directory", async () => {
 *     const path = tempDir.path("file.txt");
 *     // path is within the temp directory
 *   });
 * });
 * ```
 */
export class TempDir {
  private dirPath: string | null = null;
  private prefix: string;

  /**
   * Creates a new TempDir instance.
   *
   * @param prefix - Optional prefix for the temp directory name (default: "diricode-test-")
   */
  constructor(prefix = "diricode-test-") {
    this.prefix = prefix;
  }

  /**
   * Creates the temporary directory.
   *
   * @returns The absolute path to the created directory
   */
  async setup(): Promise<string> {
    this.dirPath = await mkdtemp(join(tmpdir(), this.prefix));
    return this.dirPath;
  }

  /**
   * Cleans up the temporary directory and all its contents.
   * Safe to call even if setup was not called or failed.
   */
  async cleanup(): Promise<void> {
    if (this.dirPath !== null) {
      await rm(this.dirPath, { recursive: true, force: true });
      this.dirPath = null;
    }
  }

  /**
   * Gets the absolute path to the temp directory.
   *
   * @returns The temp directory path
   * @throws Error if setup() has not been called
   */
  get path(): string {
    if (this.dirPath === null) {
      throw new Error("TempDir not initialized. Call setup() before accessing path.");
    }
    return this.dirPath;
  }

  /**
   * Joins path segments with the temp directory as the base.
   *
   * @param segments - Path segments to join
   * @returns The absolute resolved path
   * @throws Error if setup() has not been called
   */
  resolve(...segments: string[]): string {
    return join(this.path, ...segments);
  }
}
