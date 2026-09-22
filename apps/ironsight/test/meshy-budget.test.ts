import { describe, expect, it } from "vitest";
import config from "../config/ww1-meshy.json";

describe("Meshy budget boundary", () => {
  it("fixes the complete plan at 400 credits inside the 600/150/300 limits", () => {
    // Given: the checked-in WW1 recipe and its approved operation prices.
    const generatedCredits = config.assets.length * (config.pricing.previewCredits + config.pricing.refine2kCredits);
    const rigCredits = config.assets.filter((asset) => asset.optionalRig).length * config.pricing.rigCredits;

    // When: all baseline candidates and the two optional pilot rigs are budgeted.
    const planCredits = generatedCredits + rigCredits;

    // Then: the plan fits the authorized total while each executable batch remains separately capped.
    expect(planCredits).toBe(400);
    expect(config.limits).toEqual({ totalCredits: 600, batchCredits: 150, minimumBalance: 300 });
  });

  it("keeps the representative pilot distinct from the full inventory", () => {
    // Given: the two-entry pilot contract.
    const pilot = new Set(config.pilot);

    // When: pilot cost is derived from the same operation prices as the inventory.
    const pilotCredits = pilot.size * (config.pricing.previewCredits + config.pricing.refine2kCredits);

    // Then: it costs 60 credits and does not silently narrow the thirteen-asset plan.
    expect(pilotCredits).toBe(60);
    expect(config.assets).toHaveLength(13);
  });

  it("pins Meshy 7 at 2K without Ultra or latest aliases", () => {
    // Given/When: the only executable model recipe is inspected.
    const model = config.model;

    // Then: every cost-bearing option is explicit.
    expect(model).toMatchObject({ aiModel: "meshy-7", topology: "triangle", shouldRemesh: true, ultra: false, format: "glb", pbr: true, sourceTextureResolution: "2k" });
    expect(JSON.stringify(config)).not.toContain('"latest"');
    expect(JSON.stringify(config)).not.toContain('"8k"');
  });
});
