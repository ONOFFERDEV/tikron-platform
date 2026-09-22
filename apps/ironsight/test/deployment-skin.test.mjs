import { describe, expect, it } from "vitest";
import { SITES, siteBlueprint } from "../client/map-presentation.js";
import { DEPLOYMENT_CSS } from "../client/ui/deployment-style.js";
import { UI_TOKENS } from "../client/ui/tokens.js";

describe("deployment field skin", () => {
  it("styles every diagram without changing its collision-derived geometry", () => {
    for (const { map } of Object.values(SITES)) {
      const rectangles = [...siteBlueprint(map).matchAll(/<rect ([^>]+)\/>/g)].map(match => {
        const attributes = Object.fromEntries([...(match[1] ?? "").matchAll(/([\w-]+)="([^"]+)"/g)]
          .map(attribute => [attribute[1], attribute[2]]));
        return { kind: attributes.class, x: Number(attributes.x ?? 0), y: Number(attributes.y ?? 0),
          width: Number(attributes.width), height: Number(attributes.height) };
      });
      expect(rectangles).toEqual([
        { kind: "site-plan-ground", x: 0, y: 0, width: map.bounds.width, height: map.bounds.depth },
        ...map.boxes.filter(box => box.min.y < 1.8 && !map.terrain?.boxes.includes(box)).map(box => ({
          kind: box.max.y > 2 ? "site-plan-high" : "site-plan-low", x: box.min.x, y: box.min.z,
          width: box.max.x - box.min.x, height: box.max.z - box.min.z,
        })),
        ...(map.ramps ?? []).map(ramp => ({ kind: "site-plan-ramp", x: ramp.minX, y: ramp.minZ,
          width: ramp.maxX - ramp.minX, height: ramp.maxZ - ramp.minZ })),
      ]);
    }
  });

  it("resolves skin variables through the shared system without new combat effects", () => {
    const defined = new Set([...Object.keys(UI_TOKENS), "--ui-font-wordmark"]);
    const variables = [...DEPLOYMENT_CSS.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]);
    expect(variables.filter(variable => variable === undefined || !defined.has(variable))).toEqual([]);
    expect(DEPLOYMENT_CSS).not.toMatch(/(?:backdrop-filter|filter|text-shadow|animation)\s*:/);
    expect(DEPLOYMENT_CSS).not.toMatch(/#[a-f\d]{3,8}\b/i);
  });
});
