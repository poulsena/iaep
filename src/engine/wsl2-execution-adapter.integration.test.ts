import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HeadlessDriver } from "./headless-driver";

const isLinux = process.platform === "linux";

let baseDir: string;
let repoDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-wsl2-int-"));
  repoDir = await mkdtemp(join(tmpdir(), "iaep-wsl2-repo-"));
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
  await rm(repoDir, { recursive: true, force: true });
});

test.skipIf(!isLinux)(
  "real WSL2 bun test routes through QA gate to terminal",
  async () => {
    await writeFile(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture" })
    );
    await writeFile(
      join(repoDir, "fixture.test.ts"),
      'import { test, expect } from "bun:test";\ntest("pass", () => { expect(1).toBe(1); });'
    );

    const driver = new HeadlessDriver({ baseDir });
    const state = await driver.startRun({
      repoKey: "test/wsl2-integration",
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      repoPath: repoDir,
    });

    expect(state.status).toBe("terminal");
    expect(state.gatesPassed).toContain("qa");
  }
);

test.skipIf(!isLinux)(
  "real WSL2 bun test with failing tests blocks at QA gate",
  async () => {
    await writeFile(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture" })
    );
    await writeFile(
      join(repoDir, "fixture.test.ts"),
      'import { test, expect } from "bun:test";\ntest("fail", () => { expect(1).toBe(2); });'
    );

    const driver = new HeadlessDriver({ baseDir });
    const state = await driver.startRun({
      repoKey: "test/wsl2-integration-fail",
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      repoPath: repoDir,
    });

    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("qa");
  }
);
