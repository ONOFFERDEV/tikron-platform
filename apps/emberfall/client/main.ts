/**
 * Emberfall client boot: shows the character create/continue start screen, then
 * connects to whichever zone room the character's save points at, and renders the
 * server-authoritative `EmberState`. `?sandbox=1` boots the M0 offline asset-preview
 * path instead (`client/sandbox.ts`); `?room=<id>` overrides the room id within
 * whichever party the current zone resolves to (dev convenience, same as M1).
 */
import * as THREE from "three";
import type { SceneRig } from "./scene.js";
import { createScene } from "./scene.js";
import { setZoneAmbient } from "./ambient.js";
import { AssetRegistry } from "./assets.js";
import { UnitRenderer, type UnitData } from "./units.js";
import { InputController, type ClickableMarker } from "./input.js";
import { createTargetRing, type TargetRing } from "./targeting.js";
import { Hud, hotbarView, showZoneBanner, showToast, runFirstLoginGuide, setDeathOverlay } from "./ui.js";
import { StartScreen, clearSavedToken } from "./start-screen.js";
import { InventoryPanel, ShopPanel } from "./inventory-ui.js";
import { randomLine, DUMMY_REACTIONS, VILLAGE_RESPAWN_TEXT } from "./lore.js";
import { Minimap, type MinimapUnit } from "./minimap.js";
import { createHitFeel, type HitFeel } from "./hitfeel.js";
import {
  NetSession,
  resolveCastTarget,
  startCooldown,
  castProgress,
  unitDisplayName,
  SKILL_BY_ID,
  NO_COOLDOWNS,
  ZONE_PARTY,
  DUNGEON_PARTY,
  type CooldownState,
  type TransferTarget,
} from "./net.js";
import { CLASS_HOTBAR, isSkillUnlocked, type EmberClass } from "../src/content/hotbar.js";
import type { SavedCharacter, SavedZone } from "../src/types.js";
import type { ZoneData } from "../src/zones/types.js";
import { ASHEN_FIELDS } from "../src/zones/ashen-fields.js";
import { EMBERHOLD } from "../src/zones/emberhold.js";
import { EMBER_DEPTHS } from "../src/zones/ember-depths.js";
import { VILLAGE_ROOM_ID, FIELD_ROOM_ID } from "../src/rooms/zone-transition.js";

/** `SavedZone` -> its shared geometry data (PLAN-EMBERFALL §2.5/§3: "서버·클라 단일
 *  소스" — the exact modules the rooms clamp movement/portal-touch against). */
const ZONE_DATA: Readonly<Record<SavedZone, ZoneData>> = {
  emberhold: EMBERHOLD,
  "ashen-fields": ASHEN_FIELDS,
  "ember-depths": EMBER_DEPTHS,
};

/** Fixed room id for the two singleton (non-instanced) zones. The dungeon has no
 *  fixed id — every dungeon room is a minted invite-code instance
 *  (`zone-transition.ts`'s `mintDungeonCode`) reached via a `"transfer"` message or a
 *  shared `?dungeon=<code>` link (see `resolveInitialTarget` below), never a direct
 *  zone-based connect — `ember-room-base.ts`'s `persistSession` always normalizes a
 *  dungeon save back to `"emberhold"`, so a loaded character's `zone` is never actually
 *  `"ember-depths"` in practice. This fallback id only keeps the lookup total. */
const ZONE_ROOM_ID: Readonly<Record<SavedZone, string>> = {
  emberhold: VILLAGE_ROOM_ID,
  "ashen-fields": FIELD_ROOM_ID,
  "ember-depths": "unreachable-dungeon-zone",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves where to connect on first boot: a shared dungeon invite link
 *  (`?dungeon=<code>` — `rooms/dungeon-room.ts`'s explicit ask of this client: "a friend
 *  opening that URL should connect DIRECTLY to dungeon-room/<code>, skip walking a
 *  portal") takes priority over the character's saved zone. `?room=<id>` (dev override)
 *  applies only to the saved-zone path, matching M1's existing convention. */
function resolveInitialTarget(
  params: URLSearchParams,
  characterZone: SavedZone,
): { party: string; room: string; zone: SavedZone } {
  const dungeonCode = params.get("dungeon");
  if (dungeonCode) return { party: DUNGEON_PARTY, room: dungeonCode, zone: "ember-depths" };
  return { party: ZONE_PARTY[characterZone], room: params.get("room") ?? ZONE_ROOM_ID[characterZone], zone: characterZone };
}

/** Loads a zone's static props — obstacles, NPC-marker props, and cosmetic decorations —
 *  into the scene, removing the previously-loaded set (`prev`) first. Returns the new prop
 *  objects (to pass as the next call's `prev`) plus the clickable NPC markers. Shared by the
 *  H1 landing backdrop (which ignores the markers — no InputController exists pre-connect)
 *  and bootIntoGame's per-zone load, so the prop layout is built from one place. */
async function loadZoneProps(
  rig: SceneRig,
  assets: AssetRegistry,
  zone: ZoneData,
  prev: THREE.Object3D[],
): Promise<{ props: THREE.Object3D[]; markers: ClickableMarker[] }> {
  for (const obj of prev) rig.scene.remove(obj);
  const props: THREE.Object3D[] = [];
  for (const o of zone.obstacles) {
    const object = await assets.getPropVisual(o.prop);
    object.position.set(o.x, 0, o.y);
    if (o.rotation) object.rotation.y = o.rotation;
    rig.scene.add(object);
    props.push(object);
  }
  // NPC markers (shop/dummy — zones/types.ts's NpcMarker doc: "상점 NPC 클릭→상점 열기,
  // 허수아비=연습 타겟") render as a static, click-through prop; the returned markers let the
  // caller wire `input.setMarkers` (no attackable/interactable engine unit exists for either
  // yet — a "dummy" click is a no-op until a real target exists).
  const markers: ClickableMarker[] = [];
  for (const npc of zone.npcs ?? []) {
    if (!npc.prop) continue;
    const object = await assets.getPropVisual(npc.prop);
    object.position.set(npc.pos.x, 0, npc.pos.y);
    rig.scene.add(object);
    props.push(object);
    markers.push({ id: npc.id, object });
  }
  // Cosmetic set pieces (zones/types.ts's ZoneDecoration): collision-free props the server
  // never sees — placed exactly like obstacles, but with no marker/collision.
  for (const d of zone.decorations ?? []) {
    const object = await assets.getPropVisual(d.prop);
    object.position.set(d.pos.x, 0, d.pos.y);
    if (d.rotation) object.rotation.y = d.rotation;
    rig.scene.add(object);
    props.push(object);
  }
  return { props, markers };
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.get("sandbox") === "1") {
    const { runSandbox } = await import("./sandbox.js");
    await runSandbox();
    return;
  }

  const rig = createScene();
  const assets = new AssetRegistry();
  await assets.load();
  const units = new UnitRenderer(rig.scene, assets);
  const hudRoot = document.getElementById("hud")!;

  // H1 live-world landing (POLISH-EMBERFALL §H): render Emberhold as a slowly-orbiting
  // backdrop behind the start screen. The scene/rig is created ONCE here and reused by
  // bootIntoGame after the player picks a character — no second scene is ever built. The
  // start screen shows immediately (not gated on the prop load); props pop in when their
  // GLBs finish loading, over a blue-sky background until then.
  setZoneAmbient(rig, "emberhold");
  rig.setCinematic(UnitRenderer.toWorld(30, 30), {
    radius: 22,
    pitch: THREE.MathUtils.degToRad(35),
    yawSpeed: 0.05,
  });
  const landingLoad = loadZoneProps(rig, assets, EMBERHOLD, []);
  let landingActive = true;
  function landingFrame(): void {
    if (!landingActive) return;
    rig.updateCamera(); // drives the cinematic orbit + ambient (cloud) VFX callbacks
    rig.renderer.render(rig.scene, rig.camera);
    requestAnimationFrame(landingFrame);
  }
  requestAnimationFrame(landingFrame);

  const { token, character } = await new Promise<{ token: string; character: SavedCharacter }>((resolve) => {
    new StartScreen(hudRoot, assets, { onReady: (t, c) => resolve({ token: t, character: c }) });
  });

  // Character chosen: stop the landing loop and drop the cinematic orbit (the game camera
  // resumes following the player). The already-loaded Emberhold props are handed to
  // bootIntoGame as its initial prop set, so its first zone load reuses/replaces them
  // (Emberhold save) or swaps them out (field save) instead of stacking a second copy.
  landingActive = false;
  rig.clearCinematic();
  const landing = await landingLoad;
  await bootIntoGame(rig, assets, units, hudRoot, params, token, character, landing.props);
}

async function bootIntoGame(
  rig: SceneRig,
  assets: AssetRegistry,
  units: UnitRenderer,
  hudRoot: HTMLElement,
  params: URLSearchParams,
  initialToken: string,
  initialCharacter: SavedCharacter,
  initialProps: THREE.Object3D[],
): Promise<void> {
  const token = initialToken;
  let currentZoneId: SavedZone = initialCharacter.zone;
  // Seeded with the H1 landing backdrop's Emberhold props: the first `reloadZone` below
  // removes them (and reuses or replaces them, depending on the save's zone).
  let zoneProps: THREE.Object3D[] = initialProps;
  let transferring = false;
  // Set by the village-respawn death-panel button; consumed by `handleTransfer` so its
  // post-transfer cleanup only fires for THAT transfer, not an ordinary portal transfer.
  let pendingVillageRespawn = false;

  const fadeEl = document.createElement("div");
  fadeEl.className = "zone-fade";
  document.body.appendChild(fadeEl);

  /** Swaps the scene's props to `zone` (via the shared module-level `loadZoneProps`) and
   *  rewires the NPC markers on the input controller. `onMarkerClick` resolves a marker id
   *  back to a kind via `zone.npcs`. */
  async function reloadZone(zone: ZoneData): Promise<void> {
    const { props, markers } = await loadZoneProps(rig, assets, zone, zoneProps);
    zoneProps = props;
    input.setMarkers(markers);
  }

  let targetId: string | null = null;
  const targetRing: TargetRing = createTargetRing(units.getScene(), units);
  let myClass: EmberClass | "none" = "none";
  let cooldowns: CooldownState = NO_COOLDOWNS;
  let castTracker: { skillId: string; startMs: number } | null = null;
  /** Shop panel visibility — opened by clicking a `"shop"` NpcMarker's prop
   *  (`onMarkerClick` below) or the 'b' key fallback (for a zone with no shop marker);
   *  toggled off the same way. */
  let shopOpen = false;

  // Declared ahead of every constructor below: several callbacks close over each other
  // (net<->hud<->inventoryPanel<->shopPanel<->input), but none fire before all are assigned.
  let net: NetSession;
  let hud: Hud;
  let inventoryPanel: InventoryPanel;
  let shopPanel: ShopPanel;
  let minimap: Minimap;
  let input: InputController;

  function castHotbarSlot(slot: number): void {
    if (myClass === "none") return;
    const entry = CLASS_HOTBAR[myClass][slot - 1];
    if (!entry) return;
    const me = net.state[net.id];
    if (!me || !me.alive) return;
    if (!isSkillUnlocked(myClass, me.level, entry.skillId)) return;
    const target = resolveCastTarget(entry.skillId, targetId, net.id, net.state);
    net.send("cast", { skillId: entry.skillId, target });
  }

  /** Selects `source` as the current target on taking a hit, but only when there's no
   *  live target to protect — a manually-selected target that's still alive is never
   *  stolen out from under the player. Player-sourced damage never triggers this (M2 is
   *  PvE-only; only hostile mobs make sense as an auto-target). */
  function maybeAutoTarget(source: string): void {
    const attacker = net.state[source];
    if (!attacker || attacker.kind === "player") return;
    const current = targetId ? net.state[targetId] : undefined;
    if (current?.alive) return;
    targetId = source;
  }

  hud = new Hud(hudRoot, {
    onHotbarClick(slot) {
      castHotbarSlot(slot);
    },
    onRespawn() {
      net.send("respawn");
    },
    onRespawnVillage() {
      pendingVillageRespawn = true;
      net.send("respawnVillage");
    },
    onNewCharacter() {
      clearSavedToken();
      location.reload();
    },
  });
  hud.setCharacterInfo({ nickname: initialCharacter.nickname, cls: initialCharacter.class, level: initialCharacter.level, token });
  hud.setStatus("connecting…");

  inventoryPanel = new InventoryPanel(hudRoot, {
    onEquip(slotIndex) {
      net.send("equip", { slotIndex });
    },
    onUnequip(slot) {
      net.send("unequip", { slot });
    },
    onUseItem(slotIndex) {
      net.send("useItem", { slotIndex });
    },
    onMoveItem(from, to) {
      net.send("moveItem", { from, to });
    },
  });

  shopPanel = new ShopPanel(hudRoot, {
    onBuy(defId, qty) {
      net.send("buy", { defId, qty });
    },
    onSell(slotIndex, qty) {
      net.send("sell", { slotIndex, qty });
    },
    onClose() {
      shopOpen = false;
    },
  });

  minimap = new Minimap(hudRoot);

  // B2: full-screen red damage vignette (own DOM overlay + <style>, pointer-events:none).
  const hitfeel: HitFeel = createHitFeel();

  net = new NetSession(units, {
    onWelcome(myId) {
      hud.setStatus(`connected as ${myId.slice(0, 6)}`);
    },
    onUnitsSynced() {
      // Per-frame HUD refresh happens in the render loop below (needs the render clock).
    },
    onOwnCast(skillId) {
      const cooldownMs = SKILL_BY_ID[skillId]?.cooldownMs ?? 0;
      cooldowns = startCooldown(cooldowns, skillId, performance.now(), cooldownMs);
    },
    onLevelUp(_unitId, level, isSelf) {
      if (isSelf) hud.showLevelUp(level);
    },
    onDamaged(source) {
      maybeAutoTarget(source);
    },
    onInventory(view) {
      inventoryPanel.setView(view);
      shopPanel.setView(view);
    },
    onTransfer(target) {
      void handleTransfer(target);
    },
    onCharError(code) {
      hud.setStatus(`character error: ${code}`);
    },
  });

  async function handleTransfer(target: TransferTarget): Promise<void> {
    if (transferring) return;
    transferring = true;
    fadeEl.classList.add("zone-fade-visible");
    await sleep(220); // let the fade-to-black transition finish before tearing the scene down
    net.leave();
    currentZoneId = target.zone;
    targetId = null;
    await reloadZone(ZONE_DATA[target.zone]);
    minimap.setZone(ZONE_DATA[target.zone]);
    setZoneAmbient(rig, target.zone);
    showZoneBanner(target.zone);
    await net.connect(location.host, target.party, target.room, token);
    // A dungeon instance's room id IS its invite code (dungeon-room.ts's explicit ask
    // of this client) — reflect it in the URL so the player can copy/share the tab's
    // link and a friend opening it lands in the SAME instance via `?dungeon=<code>`.
    if (target.party === DUNGEON_PARTY) {
      const url = new URL(location.href);
      url.searchParams.set("dungeon", target.room);
      history.replaceState(null, "", url);
    }
    if (pendingVillageRespawn) {
      // A village-respawn transfer disconnects from the old room, so no same-room
      // "resurrected" event reaches net.ts to clear the death overlay — do it explicitly,
      // only for this cause (an ordinary portal transfer leaves the overlay untouched).
      pendingVillageRespawn = false;
      setDeathOverlay(false);
      showToast(VILLAGE_RESPAWN_TEXT);
    }
    await sleep(120);
    fadeEl.classList.remove("zone-fade-visible");
    transferring = false;
  }

  input = new InputController(rig.canvas, rig.camera, rig.ground, units, {
    onMoveClick(x, y) {
      const me = net.state[net.id];
      if (me && !me.alive) return; // dead players don't walk
      const zone = ZONE_DATA[currentZoneId];
      net.send("move", {
        x: Math.max(0, Math.min(zone.width, x)),
        y: Math.max(0, Math.min(zone.height, y)),
      });
    },
    onTargetClick(id) {
      if (id === net.id) return;
      targetId = id;
      net.send("attack", { unitId: id });
    },
    onHotbar(n) {
      castHotbarSlot(n);
    },
    onClearTarget() {
      targetId = null;
    },
    onMarkerClick(id) {
      const npc = ZONE_DATA[currentZoneId].npcs?.find((n) => n.id === id);
      if (npc?.kind === "shop") shopOpen = true;
      else if (npc?.kind === "dummy") showToast(randomLine(DUMMY_REACTIONS));
    },
    onDash(target) {
      net.dash(target);
    },
  });

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "r") {
      const me = net.state[net.id];
      if (me && !me.alive) net.send("respawn");
    } else if (key === "i") {
      inventoryPanel.toggle();
    } else if (key === "b") {
      shopOpen = !shopOpen;
    } else if (e.key === "Escape") {
      shopOpen = false;
      inventoryPanel.toggle(false);
    }
  });

  const initialTarget = resolveInitialTarget(params, currentZoneId);
  currentZoneId = initialTarget.zone;
  await reloadZone(ZONE_DATA[currentZoneId]);
  minimap.setZone(ZONE_DATA[currentZoneId]);
  setZoneAmbient(rig, currentZoneId);
  showZoneBanner(currentZoneId);
  setTimeout(() => runFirstLoginGuide(), 3000);
  await net.connect(location.host, initialTarget.party, initialTarget.room, token);

  // B2: previous own-unit hp, to detect damage frames (hp decrease) in the render loop.
  let myPrevHp: number | null = null;
  let last = performance.now();
  function frame(now: number): void {
    const dtMs = Math.min(now - last, 100);
    last = now;

    if (!transferring) {
      const localPos = net.tick(dtMs);
      if (localPos) rig.target.set(localPos.x, 0, localPos.y);
    }
    rig.updateCamera();
    units.tick(dtMs / 1000);

    const me = net.state[net.id];
    shopPanel.toggle(shopOpen);

    myClass = me?.class ?? "none";
    if (me) {
      hud.updateVitals({ hp: me.hp, maxHp: me.maxHp, mp: me.mp, maxMp: me.maxMp, level: me.level, class: me.class });
      hud.showDeath(!me.alive);
      // B2: pulse on hp loss; sustained low-hp vignette under 25%; off while dead (death overlay owns that).
      if (myPrevHp !== null && me.alive && me.hp < myPrevHp) hitfeel.pulse();
      hitfeel.setLowHp(me.alive && me.maxHp > 0 && me.hp / me.maxHp < 0.25);
      myPrevHp = me.hp;
      hud.updateHotbar(myClass !== "none" ? hotbarView(myClass, me.level, cooldowns, now) : null);

      if (me.cast) {
        if (!castTracker || castTracker.skillId !== me.cast) castTracker = { skillId: me.cast, startMs: now };
        hud.updateCastBar({ name: SKILL_BY_ID[me.cast]?.name ?? me.cast, pct: castProgress(me.cast, castTracker.startMs, now) });
      } else {
        castTracker = null;
        hud.updateCastBar(null);
      }
    } else {
      hud.updateVitals(null);
      hud.updateHotbar(null);
      hud.updateCastBar(null);
      hitfeel.setLowHp(false);
      myPrevHp = null;
    }

    const target = targetId ? net.state[targetId] : undefined;
    if (target && targetId) {
      hud.setTarget({ name: unitDisplayName(targetId, target, net.id), hp: target.hp, maxHp: target.maxHp, alive: target.alive });
    } else {
      hud.setTarget(null);
      if (targetId) targetId = null; // target left the AOI/state — drop it
    }
    targetRing.setTarget(targetId);
    targetRing.tick(dtMs / 1000);

    hud.renderFloatingNumbers(net.floatingNumbers(now), now, (unitId) => screenOf(rig.camera, rig.canvas, units.get(unitId)));

    const minimapUnits: MinimapUnit[] = Object.entries(net.state).map(([id, u]) => ({
      x: u.x,
      y: u.y,
      self: id === net.id,
      hostile: u.kind !== "player",
    }));
    minimap.render(minimapUnits, rig.getYaw());

    rig.renderer.render(rig.scene, rig.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Projects a unit's nameplate anchor (world pos + a small vertical offset) to screen
 *  space, or `null` when it's behind the camera or the unit isn't currently rendered. */
function screenOf(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, u: UnitData | undefined): { x: number; y: number } | null {
  if (!u) return null;
  const world = UnitRenderer.toWorld(u.x, u.y).add(new THREE.Vector3(0, 1.9, 0));
  const proj = world.project(camera);
  if (proj.z > 1 || proj.z < -1) return null;
  const rect = canvas.getBoundingClientRect();
  return { x: (proj.x * 0.5 + 0.5) * rect.width, y: (-proj.y * 0.5 + 0.5) * rect.height };
}

void main();
