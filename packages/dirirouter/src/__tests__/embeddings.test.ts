import { describe, expect, it } from "vitest";
import { computeBestMatch } from "../utils/embeddings.js";

describe("computeBestMatch stack normalization", () => {
  it("maps backend stack terms to coding without ui-ux noise", async () => {
    const result = await computeBestMatch("nodejs backend api express service", [
      "coding",
      "ui-ux",
      "architecture",
    ]);

    expect(result.method).toBe("bridge");
    expect(result.bestAttribute).toBe("coding");
    expect(result.score).toBe(1);
    expect(result.bridgeConcepts.some((hit) => hit.attribute === "ui-ux")).toBe(false);
    expect(result.bridgeConcepts.some((hit) => hit.phrase.endsWith("backend-platform"))).toBe(true);
  });

  it("keeps frontend stack terms mapped to ui-ux", async () => {
    const result = await computeBestMatch("frontend react next.js design system", [
      "coding",
      "ui-ux",
      "architecture",
    ]);

    expect(result.bestAttribute).toBe("ui-ux");
    expect(result.bridgeConcepts.some((hit) => hit.attribute === "ui-ux")).toBe(true);
  });

  it("normalizes representative data, ops, mobile, and ai stack terms", async () => {
    await expect(
      computeBestMatch("postgres prisma migration analytics", [
        "coding",
        "architecture",
        "ui-ux",
      ]),
    ).resolves.toMatchObject({ bestAttribute: "architecture", method: "bridge" });

    await expect(
      computeBestMatch("docker kubernetes github actions aws", [
        "coding",
        "architecture",
        "ui-ux",
      ]),
    ).resolves.toMatchObject({ bestAttribute: "architecture", method: "bridge" });

    const mobileResult = await computeBestMatch("react native ios android expo", [
      "coding",
      "ui-ux",
      "architecture",
    ]);
    expect(mobileResult.method).toBe("bridge");
    expect(mobileResult.score).toBeGreaterThanOrEqual(0.9);
    expect(["coding", "ui-ux"]).toContain(mobileResult.bestAttribute);
    expect(mobileResult.bridgeConcepts.some((hit) => hit.phrase.endsWith("mobile-platform"))).toBe(true);

    await expect(
      computeBestMatch("llm rag embeddings pytorch inference", [
        "reasoning",
        "coding",
        "agentic",
      ]),
    ).resolves.toMatchObject({ bestAttribute: "reasoning", method: "bridge" });
  });

  it("handles js/ts shorthand without introducing ui-ux leakage", async () => {
    const result = await computeBestMatch("build js/ts api service", [
      "coding",
      "ui-ux",
      "architecture",
    ]);

    expect(result.method).toBe("bridge");
    expect(result.bestAttribute).toBe("coding");
    expect(result.bridgeConcepts.some((hit) => hit.phrase === "js" && hit.attribute === "coding")).toBe(
      true,
    );
    expect(result.bridgeConcepts.some((hit) => hit.phrase === "ts" && hit.attribute === "coding")).toBe(
      true,
    );
    expect(result.bridgeConcepts.some((hit) => hit.attribute === "ui-ux")).toBe(false);
  });

  it("uses boundary-aware bridge matching for short aliases like pr", async () => {
    const collisionResult = await computeBestMatch("improve express middleware", [
      "code-review",
      "coding",
      "quality",
    ]);

    expect(collisionResult.bridgeConcepts.some((hit) => hit.phrase === "pr")).toBe(false);
    expect(collisionResult.bestAttribute).toBe("coding");

    const directMatchResult = await computeBestMatch("review the PR, then merge", [
      "code-review",
      "coding",
    ]);

    expect(directMatchResult.bridgeConcepts.some((hit) => hit.phrase === "pr")).toBe(true);
    expect(directMatchResult.bestAttribute).toBe("code-review");
  });
});
