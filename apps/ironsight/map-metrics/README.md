# Map metrics reports

On-demand reports from `test/map-metrics.tool.test.ts` — a real bot-vs-bot match per
map, capturing every kill's `killPos` structured log (see `src/rooms/arena-room.ts`'s
`onKill`) to build a kill-location heatmap, per-team kill/score stats, average
engagement distance, and the spawn→capture-point ETA table.

This tool is separate from the always-on map instrumentation gate
(`test/map-timing.test.ts`), which checks spawn→cap symmetry on every map edit and
runs unconditionally. This tool is env-gated and only meant to be run on demand.

Regenerate all reports:

```
MAP_METRICS=1 pnpm --filter ironsight exec vitest run test/map-metrics.tool.test.ts
```

Reports are written here as `<map>-<mode>.md` (e.g. `arena1-tdm.md`, `arena2-dom.md`)
and are overwritten on each run — they are a snapshot, not a diffable history.
