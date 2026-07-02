import { useState } from "react";
import { useParams } from "react-router";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { KeysTab } from "./tabs/KeysTab";
import { UsageTab } from "./tabs/UsageTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { GettingStartedTab } from "./tabs/GettingStartedTab";

const TABS = [
  { id: "usage", label: "Usage" },
  { id: "keys", label: "API keys" },
  { id: "rooms", label: "Live rooms" },
  { id: "start", label: "Getting started" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<TabId>("usage");

  // No single-project endpoint in the contract; resolve the display name from
  // the project list. Detail data is loaded per-tab against the id from the URL.
  const projects = useApi(() => api.listProjects(), []);
  const project = projects.data?.find((p) => p.id === id);
  const name = project?.name ?? "Project";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{name}</h1>
          <p className="page-sub mono">{id}</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Project sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        {tab === "usage" && <UsageTab projectId={id} />}
        {tab === "keys" && <KeysTab projectId={id} />}
        {tab === "rooms" && <RoomsTab projectId={id} />}
        {tab === "start" && <GettingStartedTab projectId={id} />}
      </div>
    </div>
  );
}
