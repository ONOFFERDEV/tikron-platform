import { describe, expect, it } from "vitest";
import { ScenePreparationLifetime } from "../client/scene-preparation.js";

describe("scene preparation lifetime", () => {
  it("invalidates an asynchronous preparation boundary after context disposal", async () => {
    const lifetime = new ScenePreparationLifetime();
    const generation = lifetime.begin();
    let resolve: ((value: string) => void) | undefined;
    const pending = new Promise<string>(done => { resolve = done; });
    const boundary = lifetime.wait(generation, pending);

    lifetime.cancel();
    if (resolve === undefined) throw new Error("missing preparation resolver");
    resolve("renderer-work");

    await expect(boundary).resolves.toEqual({ active: false });
  });

  it("returns the value while the scene context remains active", async () => {
    const lifetime = new ScenePreparationLifetime();
    await expect(lifetime.wait(lifetime.begin(), Promise.resolve("renderer-work"))).resolves.toEqual({
      active: true,
      value: "renderer-work",
    });
  });

  it("keeps preparation inactive when it begins after disposal", async () => {
    const lifetime = new ScenePreparationLifetime();
    lifetime.cancel();
    await expect(lifetime.wait(lifetime.begin(), Promise.resolve("renderer-work"))).resolves.toEqual({ active: false });
  });
});
