/**
 * generate.ts — M3 client side of the Generate panel: POSTs to /api/generate,
 * streams the SSE progress log, and on success fetches the resulting GLB —
 * handed back as a plain File so the caller can feed it through the exact same
 * load path as drag&drop/file-picker (see main.ts's loadFile()).
 */
export interface GenerateParams {
  prompt: string;
  name: string;
  seed: number | undefined;
  backend: "hunyuan" | "trellis";
  gameSlim: boolean;
}

export interface GenerateCallbacks {
  onLog(line: string): void;
  /** Validation/lock/network/pipeline failure — always terminal (no File follows). */
  onError(message: string): void;
}

interface DonePayload {
  success: boolean;
  error?: string;
}

/** Runs the whole Generate flow. Resolves to a File ready for the existing GLB
 *  loader on success, or undefined on any failure (onError already explained why). */
export async function runGenerate(params: GenerateParams, cb: GenerateCallbacks): Promise<File | undefined> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    cb.onError(`request failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }

  if (res.status !== 202) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    cb.onError(body.error ?? `unexpected response (${res.status})`);
    return undefined;
  }
  const { jobId } = (await res.json()) as { jobId: string };

  const outcome = await new Promise<DonePayload>((resolve) => {
    const es = new EventSource(`/api/generate/${jobId}/events`);
    es.addEventListener("log", (e) => {
      cb.onLog(JSON.parse((e as MessageEvent).data) as string);
    });
    es.addEventListener("done", (e) => {
      es.close();
      resolve(JSON.parse((e as MessageEvent).data) as DonePayload);
    });
    // A loopback SSE connection dropping mid-job without ever sending "done" is
    // not handled beyond the browser's own auto-reconnect (out of scope for this
    // internal tool) — the server always replays buffered history to a fresh
    // subscriber, so a reconnect self-heals the log view.
  });

  if (!outcome.success) {
    cb.onError(outcome.error ?? "generation failed");
    return undefined;
  }

  const glbRes = await fetch(`/api/generate/${jobId}/result.glb`);
  if (!glbRes.ok) {
    cb.onError(`failed to fetch result.glb (${glbRes.status})`);
    return undefined;
  }
  const blob = await glbRes.blob();
  return new File([blob], `${params.name}.glb`, { type: "model/gltf-binary" });
}

/** Lowercases and strips `prompt` down to the `name` field's allowed charset
 *  (`[a-z0-9][a-z0-9-]*`), for the auto-slug-until-edited UX. */
export function slugify(prompt: string): string {
  const collapsed = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const sliced = collapsed.slice(0, 40).replace(/-+$/g, "");
  return sliced || "generated";
}
