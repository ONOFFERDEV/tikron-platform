import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("WW1 environment builder CLI", () => {
  it("rebuilds and audits every authored output", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "ironsight-environment-"));
    const reportPath = join(fixtureRoot, "audit.json");
    try {
      const result = await execFileAsync(process.execPath, [
        "tools/build-ww1-environment.mjs", "--build", "--audit", "--asset-root", fixtureRoot, "--out", reportPath,
      ], { cwd: process.cwd() });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      expect(result.stderr).toBe("");
      expect(report.localValid).toBe(true);
      expect(report.files).toHaveLength(13);
      expect(report.files.every((file) => file.valid)).toBe(true);
      expect(report.outstanding).toEqual(["aside:environment-kit"]);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
