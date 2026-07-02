import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { isLocationHint, resolveLocationHint } from "../src/region.js";

describe("region hint validation", () => {
  it("accepts the known Cloudflare hints and rejects others", () => {
    expect(isLocationHint("weur")).toBe(true);
    expect(isLocationHint("apac")).toBe(true);
    expect(isLocationHint("mars")).toBe(false);
    expect(isLocationHint("")).toBe(false);
  });

  it("resolves a valid ?region= off a URL and ignores an invalid one", () => {
    expect(resolveLocationHint(new URL("https://x/parties/agar-room/r?region=enam"))).toBe("enam");
    expect(resolveLocationHint(new URL("https://x/parties/agar-room/r?region=nope"))).toBeUndefined();
    expect(resolveLocationHint(new URL("https://x/parties/agar-room/r"))).toBeUndefined();
  });
});

describe("region placement plumbing (workerd)", () => {
  it("matchmake records a valid region and echoes it in the reservation", async () => {
    const res = await SELF.fetch("https://example.com/api/matchmake?type=t-region&region=weur");
    const body = (await res.json()) as { roomId: string; sessionId: string; region?: string };
    expect(res.status).toBe(200);
    expect(body.region).toBe("weur");

    // A reused room keeps its original placement hint.
    const res2 = await SELF.fetch("https://example.com/api/matchmake?type=t-region&region=weur&max=8");
    const body2 = (await res2.json()) as { roomId: string; region?: string };
    expect(body2.roomId).toBe(body.roomId);
    expect(body2.region).toBe("weur");
  });

  it("matchmake rejects an invalid region with an agent-friendly 400", async () => {
    const res = await SELF.fetch("https://example.com/api/matchmake?type=t-region&region=narnia");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("invalid_region");
    expect(body.message).toMatch(/weur/); // lists the accepted hints
  });

  it("carries ?region= through the /parties connect path without breaking routing", async () => {
    // Placement itself is not observable locally; assert the plumbing executes end
    // to end (the hint reaches routePartykitRequest and the socket still upgrades).
    const res = await SELF.fetch(
      `https://example.com/parties/agar-room/rg-${crypto.randomUUID()}?_session=s-${crypto.randomUUID()}&region=weur`,
      { headers: { Upgrade: "websocket" } },
    );
    expect(res.webSocket).toBeTruthy();
    res.webSocket!.accept();
    res.webSocket!.close();
  });
});
