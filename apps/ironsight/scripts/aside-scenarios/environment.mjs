import { VERDICT } from "../aside-common.mjs";
import { closeOwnedTab, recoverStaleFetchInterception, replJson } from "./performance.mjs";

const ENVIRONMENT_KEYS = [
  "trench-wall", "duckboard", "sandbag", "timber-brace", "wire", "rail-platform",
  "brick-rubble", "field-telephone", "ammo-crate", "supply-wagon", "observation-post",
  "freight-wagon-wreck", "biplane",
];

function result(id, passed, observations, artifacts, code, unqualified) {
  return {
    id,
    verdict: passed ? VERDICT.PASS : unqualified ? VERDICT.UNQUALIFIED : VERDICT.FAIL,
    reasons: passed ? [] : [{ code }],
    observations: observations ?? null,
    artifacts,
  };
}

export function classifyEnvironmentKit(definition, observations, artifacts) {
  const trusted = observations.inputKind === "aside-runtime-inspector" && artifacts.length > 0;
  const normal = observations.normal;
  const assets = normal?.assets ?? [];
  const completeInventory = trusted && normal?.ready === true
    && ENVIRONMENT_KEYS.every((key) => assets.some((asset) => asset.key === key
      && asset.loaded === true && asset.views >= 4 && asset.boundsValid === true && asset.socketsValid === true));
  const combatDistance = normal?.combatDistance;
  const distanceComplete = trusted && combatDistance?.nearM <= 5 && combatDistance?.farM >= 40;
  const failures = observations.failures ?? {};
  const failureCase = (id, observed, code) => result(
    id,
    trusted && observed?.attempted === true && observed?.rejected === true,
    observed,
    artifacts,
    code,
    !trusted || observed?.attempted !== true,
  );
  return [
    result(definition.cases[0], completeInventory, normal ?? null, artifacts, "environment_turntables_incomplete", !trusted || normal?.ready !== true),
    result(definition.cases[1], distanceComplete && combatDistance.readable === true, combatDistance ?? null, artifacts, "combat_distance_unreadable", !distanceComplete),
    failureCase(definition.cases[2], failures.badScale, "bad_scale_not_rejected"),
    failureCase(definition.cases[3], failures.invalidSurface, "invalid_surface_not_rejected"),
    failureCase(definition.cases[4], failures.blockedDoorway, "blocked_doorway_not_rejected"),
  ];
}

async function capture(context, name) {
  const sessionName = `${name}.png`;
  const receipt = await replJson(context.repl, `
    await fs.mkdir('./artifacts',{recursive:true});
    const binding=async()=>({url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin),view:await page.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],caseName:new URLSearchParams(location.search).get('environment-case'),ready:window.__environmentInspect?.ready===true,figures:document.querySelectorAll('figure').length}))});
    try{const before=await binding();await page.screenshot({path:'./artifacts/${sessionName}',timeout:60000});const bytes=await fs.readFile('./artifacts/${sessionName}');const after=await binding();return {ok:before.url===after.url&&before.timeOrigin===after.timeOrigin,kind:'raw',bytes:bytes.length,pixels:[bytes.readUInt32BE(16),bytes.readUInt32BE(20)],before,after}}
    catch(rawError){const detail=rawError.name+': '+rawError.message;if(!/unsupported|not found|not implemented/i.test(detail))return {ok:false,kind:'raw',bytes:0,error:detail};
      try{const before=await binding();const image=await annotatedScreenshot(page);const bytes=Buffer.from(image.base64Image,'base64');await fs.writeFile('./artifacts/${sessionName}',bytes);const after=await binding();return {ok:before.url===after.url&&before.timeOrigin===after.timeOrigin,kind:'annotated-fallback',bytes:bytes.length,pixels:[bytes.readUInt32BE(16),bytes.readUInt32BE(20)],before,after,error:detail}}
      catch(fallbackError){return {ok:false,kind:'annotated-fallback',bytes:0,error:detail+'; '+fallbackError.name+': '+fallbackError.message}}
    }
  `, { timeoutMs: 70_000 });
  if (!receipt.ok || receipt.bytes <= 0) throw new Error(`environment capture failed (${receipt.kind}): ${receipt.error}`);
  return { ...receipt, artifacts: [await context.copySessionArtifact(sessionName, `screenshots/${sessionName}`)] };
}

async function captureGallery(context) {
  const receipt = await replJson(context.repl, `
    await fs.mkdir('./artifacts/environment-gallery',{recursive:true});
    const binding=async()=>({url:page.url(),timeOrigin:await page.evaluate(()=>performance.timeOrigin),view:await page.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],caseName:new URLSearchParams(location.search).get('environment-case'),ready:window.__environmentInspect?.ready===true,figures:document.querySelectorAll('figure').length}))});
    const before=await binding();const views=await page.evaluate(()=>[...document.querySelectorAll('figure img')].map((image,index)=>({index,alt:image.alt,src:image.src})));
    const entries=[];for(const view of views){const bytes=Buffer.from(view.src.slice(view.src.indexOf(',')+1),'base64');const name='view-'+String(view.index).padStart(2,'0')+'.png';await fs.writeFile('./artifacts/environment-gallery/'+name,bytes);entries.push({name,alt:view.alt,bytes:bytes.length,pixels:[bytes.readUInt32BE(16),bytes.readUInt32BE(20)]})}
    const after=await binding();return {ok:views.length===52&&before.url===after.url&&before.timeOrigin===after.timeOrigin,kind:'dom-gallery',bytes:entries.reduce((sum,item)=>sum+item.bytes,0),entries,before,after};
  `, { timeoutMs: 40_000 });
  if (!receipt.ok) throw new Error(`environment gallery capture failed: ${receipt.entries.length}/52 bound views`);
  const artifacts = [];
  for (const entry of receipt.entries) artifacts.push(await context.copySessionArtifact(`environment-gallery/${entry.name}`, `screenshots/environment-gallery/${entry.name}`));
  return { ...receipt, artifacts };
}

async function inspectCase(context, caseName) {
  const url = new URL(context.url);
  url.searchParams.set("inspect", "environment-kit");
  url.searchParams.set("environment-case", caseName);
  const observed = await replJson(context.repl, `
    await page.goto(${JSON.stringify(url.href)});const started=Date.now();
    while(Date.now()-started<95000&&!await page.evaluate(()=>window.__environmentInspect?.ready===true||window.__environmentInspect?.unsupported===true))await sleep(500);
    return await page.evaluate(async()=>{const resources=performance.getEntriesByType('resource').map(item=>new URL(item.name).pathname);
      const models=[...new Set(resources.filter(item=>item.toLowerCase().endsWith('.glb')))];
      const assetResponses=await Promise.all(models.map(async pathname=>{const response=await fetch(pathname,{cache:'no-store'});const bytes=new Uint8Array(await response.arrayBuffer());const digest=await crypto.subtle.digest('SHA-256',bytes);return {pathname,status:response.status,bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}}));
      return {report:window.__environmentInspect??null,resources,assetResponses};});
  `, { timeoutMs: 105_000 });
  const captured = caseName === "normal" ? await captureGallery(context) : await capture(context, `environment-${caseName}`);
  return { ...observed, capture: captured };
}

async function runEnvironmentKit(context) {
  let opened = false;
  let ownedTargetId = null;
  try {
    const ownership = await replJson(context.repl, `
      const before=await listBrowserTabs(),ids=new Set(before.map(item=>item.targetId));await openTab('about:blank');
      const owned=(await listBrowserTabs()).filter(item=>!ids.has(item.targetId));return {ownedTargetId:owned.length===1?owned[0].targetId:null};
    `);
    opened = true;
    ownedTargetId = ownership.ownedTargetId;
    const recovery = await recoverStaleFetchInterception(context.repl);
    if (!recovery.disabled) throw new Error(`Fetch cleanup failed: ${recovery.errors.join("; ")}`);
    const normal = await inspectCase(context, "normal");
    const badScale = await inspectCase(context, "bad-scale");
    const invalidSurface = await inspectCase(context, "invalid-surface");
    const blockedDoorway = await inspectCase(context, "blocked-doorway");
    const inspections = [normal, badScale, invalidSurface, blockedDoorway];
    const trusted = inspections.every((inspection) => inspection.report?.inputKind === "aside-runtime-inspector");
    const observations = {
      inputKind: trusted ? "aside-runtime-inspector" : "inspector-unavailable",
      normal: normal.report,
      failures: {
        badScale: badScale.report?.failure,
        invalidSurface: invalidSurface.report?.failure,
        blockedDoorway: blockedDoorway.report?.failure,
      },
      resources: inspections.flatMap((inspection) => inspection.resources),
      assetResponses: normal.assetResponses,
      captures: inspections.map((inspection) => ({
        kind: inspection.capture.kind,
        bytes: inspection.capture.bytes,
        pixels: inspection.capture.pixels,
        before: inspection.capture.before,
        after: inspection.capture.after,
        artifacts: inspection.capture.artifacts,
      })),
    };
    const artifacts = inspections.flatMap((inspection) => inspection.capture.artifacts);
    artifacts.push(await context.writeArtifact("traces/environment-kit.json", observations));
    return {
      cases: classifyEnvironmentKit(context.definition, observations, artifacts),
      inputProvenance: trusted
        ? "Aside production environment inspector with fixed cameras and explicit failure fixtures"
        : "Aside page capture; required runtime environment inspector unavailable",
      observations,
    };
  } finally {
    let closeReceipt = null;
    if (opened) closeReceipt = await closeOwnedTab(context.repl);
    context.recordCleanup({ opened, ownedTargetId, closeReceipt });
  }
}

export const scenarioHandlers = Object.freeze({
  "environment-kit": runEnvironmentKit,
});
