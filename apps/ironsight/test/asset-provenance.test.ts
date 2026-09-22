import { describe, expect, it } from "vitest";
import config from "../config/ww1-meshy.json";
import { WW1_ASSET_MANIFEST } from "../config/ww1-assets.js";

describe("WW1 Meshy provenance recipe", () => {
  it("maps exactly the six generated environment candidates to task-3 manifest keys", () => {
    // Given: the task-7 recipe and task-3's stable environment provenance contract.
    const environmentRole = "environment-prop";

    // When: environment candidates are selected.
    const keys = config.assets.filter((asset) => asset.role === environmentRole).map((asset) => asset.assetKey);

    // Then: sourceKind=meshy-generated can join by stable key without editing the shared manifest.
    expect(keys).toEqual(["supply-wagon", "ammo-crate", "field-telephone", "freight-wagon-wreck", "brick-rubble", "observation-post"]);
  });

  it("contains only authorization hashes, never credentials, task identifiers, provider URLs, or output hashes", () => {
    // Given: retry authorization hashes are separated from generation/runtime state.
    const authorizationHashes = Object.values(config.retryRecipes).flat().map((recipe) => recipe.authorizationSha256);
    const retryRecipes = Object.fromEntries(Object.entries(config.retryRecipes).map(([key, recipes]) => [key, recipes.map(({ authorizationSha256: _, ...recipe }) => recipe)]));
    const text = JSON.stringify({ ...config, retryRecipes });

    // When/Then: hashes bind reviewed retry specs, while the remaining recipe has no runtime lineage.
    expect(authorizationHashes).toHaveLength(2);
    expect(authorizationHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
    expect(text).not.toMatch(/api[_-]?key|bearer|taskId|signed|https?:\/\//i);
    expect(text).not.toMatch(/[a-f0-9]{64}/i);
  });

  it("matches every generated recipe to task-3's exact role and receipt path", () => {
    // Given: task 3's typed provenance entries from every generated asset family.
    const provenance = [
      ...WW1_ASSET_MANIFEST.weapons.map((asset) => asset.provenance),
      ...WW1_ASSET_MANIFEST.soldiers.map((asset) => asset.provenance),
      ...WW1_ASSET_MANIFEST.environment.map((asset) => asset.provenance),
    ].filter((entry) => entry.sourceKind === "meshy-generated");

    // When: task-7 recipes are joined by their stable receipt path.
    const expected = config.assets.map((asset) => ({ role: asset.role, receiptPath: `artifacts/ww1/receipts/${asset.assetKey.replaceAll("_", "-")}.json` })).sort((left, right) => left.receiptPath.localeCompare(right.receiptPath));
    const actual = provenance.map((entry) => ({ role: entry.receiptRole, receiptPath: entry.receiptPath })).sort((left, right) => left.receiptPath.localeCompare(right.receiptPath));

    // Then: no generated key, role, or lineage path can drift between owners.
    expect(actual).toEqual(expected);
  });
});
