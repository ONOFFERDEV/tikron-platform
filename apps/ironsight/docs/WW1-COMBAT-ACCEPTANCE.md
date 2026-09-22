# WW1 combat acceptance trace

`scripts/combat-acceptance.mjs` analyzes evidence collected by the Aside combat scenarios. It does not drive the browser and cannot turn synthetic input into a pass.

Run it from `apps/ironsight`:

```sh
node scripts/combat-acceptance.mjs --input <trace.json> --out <report.json>
```

The input uses `schemaVersion: 1`, binds the source and browser bundle with SHA-256 values, and records the exact 1920x1080 viewport, refresh rate, pointer-lock result, trusted-input status, and input video path. `runs` must contain normal and reduced-motion traces for every combination of TDM, FFA, DOM, and weapon indices 0 through 4.

Each run embeds the current `CombatTelemetry.snapshot()` contract. Local stages use the client-monotonic clock in this order: input, handler, send, predicted commit, audio schedule, receipt, and confirmed paint. Server receive and resolve use the separate server-wall clock. Cross-clock subtraction is forbidden.

Acceptance requires:

- complete 30-run coverage and one or more trusted-device shots plus an ADS transition per run;
- a sample for every latency pair in the telemetry contract;
- gesture-to-predicted-commit p95 no greater than one render interval plus 5 ms;
- matched movement error no greater than 0.01 m;
- zero false hits, false kills, duplicate shots, or dropped valid edges;
- identical authority judgments with normal and reduced motion.

An unavailable trusted-input, pointer-lock, viewport, refresh-rate, or video surface returns `UNQUALIFIED` with exit code 2. Invalid or incomplete evidence returns `FAIL` with exit code 1. Only complete evidence returns `PASS` with exit code 0. Device latency, photon latency, speaker latency, sound quality, and target-device performance remain outside this report.
