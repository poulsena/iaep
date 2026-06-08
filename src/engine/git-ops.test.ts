import { describe, expect, test } from "bun:test";
import { branchSlug } from "./git-ops";

describe("branchSlug", () => {
  test("normalizes brief text to kebab-case", () => {
    expect(branchSlug("Add listRuns to InFlightStore")).toBe(
      "add-listruns-to-inflightstore"
    );
  });

  test("returns 'untitled' for empty string", () => {
    expect(branchSlug("")).toBe("untitled");
  });

  test("truncates to 40 characters", () => {
    const long = "a".repeat(50);
    expect(branchSlug(long).length).toBeLessThanOrEqual(40);
  });
});
