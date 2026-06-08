import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectConventionalAdapter } from "./project-detector";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "iaep-detect-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("project detector", () => {
  test("returns an adapter for a package.json project", async () => {
    await writeFile(join(tmpDir, "package.json"), '{"name":"test"}');
    const adapter = await detectConventionalAdapter(tmpDir);
    expect(adapter).not.toBeUndefined();
  });

  test("returns undefined when no recognized project file is present", async () => {
    const adapter = await detectConventionalAdapter(tmpDir);
    expect(adapter).toBeUndefined();
  });
});
