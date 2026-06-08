import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeadlessDriver } from "./headless-driver";

let baseDir: string;
let repoDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-autodetect-"));
  repoDir = await mkdtemp(join(tmpdir(), "iaep-repo-"));
  driver = new HeadlessDriver({ baseDir });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
  await rm(repoDir, { recursive: true, force: true });
});

describe("project auto-detect in HeadlessDriver", () => {
  test("auto-detects bun adapter from package.json and routes QA gate to terminal", async () => {
    await writeFile(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "test" })
    );
    await writeFile(
      join(repoDir, "pass.test.ts"),
      'import { test, expect } from "bun:test";\ntest("ok", () => { expect(1).toBe(1); });'
    );
    const state = await driver.startRun({
      repoKey: "test/autodetect",
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      repoPath: repoDir,
    });
    expect(state.status).toBe("terminal");
    expect(state.gatesPassed).toContain("qa");
  });

  test("throws when repoPath has no recognizable project and a QA stage is requested", () => {
    expect(
      driver.startRun({
        repoKey: "test/unknown",
        lane: "quick-change",
        stages: [{ name: "qa", role: "qa" }],
        repoPath: repoDir,
      })
    ).rejects.toThrow();
  });
});
