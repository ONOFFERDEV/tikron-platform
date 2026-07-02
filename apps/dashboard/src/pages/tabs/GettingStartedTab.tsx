import { api } from "../../api/client";
import { CopyButton } from "../../components/CopyButton";
import { useApi } from "../../hooks/useApi";

/** Copy-paste client SDK snippet, seeded with this project's key prefix when an
 *  active key exists (the full secret is never retrievable after creation). */
export function GettingStartedTab({ projectId }: { projectId: string }) {
  const keys = useApi(() => api.listKeys(projectId), [projectId]);

  const activePrefix = keys.data?.find((k) => !k.revokedAt)?.prefix;
  const apiKey = activePrefix ? `${activePrefix}...` : "pe_live_...";

  const snippet = `import { GameClient } from "@playedge/client";

const client = new GameClient(location.host, {
  apiKey: "${apiKey}",
});

const room = await client.join("lobby");
room.onStateChange((state) => render(state));
room.send("move", { x, y });`;

  const installSnippet = "pnpm add @playedge/client";

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="section-title">Getting started</h2>
          <p className="section-sub">Connect a browser client to this project in two steps.</p>
        </div>
      </div>

      <ol className="steps">
        <li>
          <span className="step-label">1. Install the client SDK</span>
          <div className="snippet">
            <code>{installSnippet}</code>
            <CopyButton value={installSnippet} />
          </div>
        </li>
        <li>
          <span className="step-label">2. Connect with your API key</span>
          {!activePrefix && !keys.loading && (
            <p className="muted">
              No active key yet — create one on the <strong>API keys</strong> tab, then paste it
              below in place of <code>pe_live_…</code>.
            </p>
          )}
          <div className="snippet snippet-block">
            <pre className="mono">{snippet}</pre>
            <CopyButton value={snippet} label="Copy snippet" />
          </div>
        </li>
      </ol>

      <p className="muted">
        Want a full working game to start from?{" "}
        <a href="/agar.html" target="_blank" rel="noreferrer">
          Open the agar.io demo ↗
        </a>
      </p>
    </section>
  );
}
