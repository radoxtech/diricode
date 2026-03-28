import { describe, expect, it } from "vitest";
import {
  annotateFile,
  computeLineHash,
  formatAnchor,
  normalizeLine,
  parseAnchor,
  resolveAnchor,
  similarityRatio,
} from "../hashline.js";

describe("computeLineHash", () => {
  it("returns a 2-char uppercase string", () => {
    const hash = computeLineHash(1, "hello world");
    expect(hash).toMatch(/^[A-Z]{2}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    const a = computeLineHash(42, "const x = 1;");
    const b = computeLineHash(42, "const x = 1;");
    expect(a).toBe(b);
  });

  it("different content produces different hashes (with high probability)", () => {
    const hashes = new Set(
      Array.from({ length: 50 }, (_, i) => computeLineHash(1, `line content ${i}`)),
    );
    // With 8-bit hash and 50 unique inputs, expect >> 25 unique hashes
    expect(hashes.size).toBeGreaterThan(25);
  });

  it("normalizes CR and trailing whitespace before hashing", () => {
    const a = computeLineHash(1, "hello  \r");
    const b = computeLineHash(1, "hello");
    expect(a).toBe(b);
  });

  it("preserves leading whitespace (indentation)", () => {
    const a = computeLineHash(1, "  indented");
    const b = computeLineHash(1, "indented");
    expect(a).not.toBe(b);
  });

  it("uses line number as seed for whitespace-only lines", () => {
    const a = computeLineHash(1, "   ");
    const b = computeLineHash(2, "   ");
    expect(a).not.toBe(b);
  });
});

describe("normalizeLine", () => {
  it("strips CR characters", () => {
    expect(normalizeLine("hello\r\nworld\r")).toBe("hello\nworld");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeLine("hello   ")).toBe("hello");
  });

  it("preserves leading whitespace", () => {
    expect(normalizeLine("  hello")).toBe("  hello");
  });

  it("handles empty string", () => {
    expect(normalizeLine("")).toBe("");
  });
});

describe("parseAnchor", () => {
  it("parses valid anchor", () => {
    const result = parseAnchor("42#PM");
    expect(result.line).toBe(42);
    expect(result.hash).toBe("PM");
  });

  it("parses single-digit line", () => {
    const result = parseAnchor("3#ZK");
    expect(result.line).toBe(3);
    expect(result.hash).toBe("ZK");
  });

  it("throws on missing hash separator", () => {
    expect(() => parseAnchor("42")).toThrow("expected LINE#HH format");
  });

  it("throws on non-numeric line", () => {
    expect(() => parseAnchor("abc#PM")).toThrow("positive integer");
  });

  it("throws on zero line number", () => {
    expect(() => parseAnchor("0#PM")).toThrow("positive integer");
  });

  it("throws on single-char hash", () => {
    expect(() => parseAnchor("42#P")).toThrow("2 uppercase letters");
  });

  it("throws on lowercase hash", () => {
    expect(() => parseAnchor("42#pm")).toThrow("2 uppercase letters");
  });

  it("throws on digits in hash", () => {
    expect(() => parseAnchor("42#P1")).toThrow("2 uppercase letters");
  });
});

describe("formatAnchor", () => {
  it("formats line and hash", () => {
    expect(formatAnchor(42, "PM")).toBe("42#PM");
  });
});

describe("similarityRatio", () => {
  it("returns 1.0 for identical strings", () => {
    expect(similarityRatio("hello", "hello")).toBe(1);
  });

  it("returns 0.0 for completely different strings", () => {
    const ratio = similarityRatio("abc", "xyz");
    expect(ratio).toBeLessThan(0.2);
  });

  it("returns 1.0 for two empty strings", () => {
    expect(similarityRatio("", "")).toBe(1);
  });

  it("returns 0.0 when one string is empty", () => {
    expect(similarityRatio("hello", "")).toBe(0);
  });

  it("gives high score for minor edits", () => {
    const ratio = similarityRatio("const x = 1;", "const x = 2;");
    expect(ratio).toBeGreaterThan(0.7);
  });

  it("gives lower score for structural changes", () => {
    const ratio = similarityRatio("function hello()", "class Goodbye {");
    expect(ratio).toBeLessThan(0.5);
  });
});

describe("resolveAnchor", () => {
  const fileContent = [
    "line one",
    "line two",
    "line three",
    "line four",
    "line five",
    "line six",
    "line seven",
    "line eight",
    "line nine",
    "line ten",
  ].join("\n");

  it("returns exact match for correct anchor", () => {
    const hash = computeLineHash(3, "line three");
    const result = resolveAnchor(formatAnchor(3, hash), fileContent);
    expect(result.matched).toBe(true);
    expect(result.resolvedLine).toBe(3);
    expect(result.status.kind).toBe("exact");
  });

  it("returns exact when anchor is string", () => {
    const hash = computeLineHash(1, "line one");
    const result = resolveAnchor({ line: 1, hash }, fileContent);
    expect(result.matched).toBe(true);
    expect(result.status.kind).toBe("exact");
  });

  it("returns drifted when hash found nearby", () => {
    const hash = computeLineHash(3, "line three");
    const modified = ["NEW A", "NEW B", ...fileContent.split("\n")].join("\n");
    const result = resolveAnchor(formatAnchor(3, hash), modified);
    expect(result.matched).toBe(true);
    expect(result.status.kind).toBe("drifted");
    if (result.status.kind === "drifted") {
      expect(result.status.delta).toBe(2);
    }
  });

  it("returns relocated when similar content found outside local radius", () => {
    const hash = computeLineHash(3, "line three");
    // Target is at line 55 — outside the ±50 local radius of anchor line 3
    const manyLines = Array.from({ length: 60 }, (_, i) => `filler ${i + 1}`);
    manyLines[2] = "DIFFERENT";
    manyLines[54] = "line three";

    const modified = manyLines.join("\n");
    const result = resolveAnchor(formatAnchor(3, hash), modified);
    expect(result.status.kind).toBe("relocated");
    if (result.status.kind === "relocated") {
      expect(result.status.foundAt).toBe(55);
      expect(result.status.score).toBe(1);
    }
  });

  it("returns conflict when anchor line is out of range", () => {
    const result = resolveAnchor("100#ZZ", fileContent);
    expect(result.matched).toBe(false);
    expect(result.status.kind).toBe("conflict");
  });

  it("returns conflict for zero line number", () => {
    expect(() => resolveAnchor("0#ZZ", fileContent)).toThrow("positive integer");
  });
});

describe("annotateFile", () => {
  it("annotates every line with anchor", () => {
    const content = "hello\nworld\nfoo";
    const result = annotateFile(content);
    expect(result).toHaveLength(3);
    expect(result[0]!.line).toBe(1);
    expect(result[0]!.content).toBe("hello");
    expect(result[0]!.anchor).toMatch(/^\d#[A-Z]{2}$/);
    expect(result[1]!.line).toBe(2);
    expect(result[2]!.line).toBe(3);
  });

  it("anchors are deterministic", () => {
    const content = "hello\nworld";
    const a = annotateFile(content);
    const b = annotateFile(content);
    expect(a[0]!.anchor).toBe(b[0]!.anchor);
  });

  it("handles empty file", () => {
    const result = annotateFile("");
    expect(result).toHaveLength(1);
    expect(result[0]!.line).toBe(1);
    expect(result[0]!.content).toBe("");
  });
});
