import { describe, expect, it } from "vitest";

import { authoredEnvironmentEnabled } from "../client/environment-selection.js";

describe("authored environment selection", () => {
  it("loads admitted authored props by default and retains an explicit fallback diagnostic", () => {
    expect(authoredEnvironmentEnabled("")).toBe(true);
    expect(authoredEnvironmentEnabled("?environment-candidates=1")).toBe(true);
    expect(authoredEnvironmentEnabled("?environment-candidates=0")).toBe(false);
  });
});
