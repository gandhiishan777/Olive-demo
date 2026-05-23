import { describe, it, expect } from "vitest";
import { diceCoefficient, fuzzyScore } from "../lib/fuzzy.js";

describe("diceCoefficient", () => {
  it("identical strings = 1", () => {
    expect(diceCoefficient("chicken biryani", "chicken biryani")).toBe(1);
  });
  it("disjoint strings = 0", () => {
    expect(diceCoefficient("xyz", "abc")).toBe(0);
  });
  it("close strings > 0.5", () => {
    expect(diceCoefficient("biryani", "biriyani")).toBeGreaterThan(0.5);
  });
});

describe("fuzzyScore", () => {
  it("substring match boosts score", () => {
    const score = fuzzyScore("biryani", { name: "Chicken Biryani" });
    expect(score).toBeGreaterThanOrEqual(0.5);
  });
  it("typo matches", () => {
    const score = fuzzyScore("biriyani", { name: "Chicken Biryani" });
    expect(score).toBeGreaterThan(0.4);
  });
});
