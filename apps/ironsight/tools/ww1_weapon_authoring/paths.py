# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Absolute-path boundary for the Task8 weapon production batch."""

from pathlib import Path

EXPECTED_OUTPUT_ROOT = Path("D:/wt-ironsight-ww1-recovery-20260912/apps/ironsight/.inspect/ww1-art/production-candidates-v3")
EXPECTED_EVIDENCE_ROOT = Path("D:/webgame-baas/.omo/evidence/ww1/task-08/production-candidates-v3")
RENDER_NAMES = ("side-right", "three-quarter-front", "muzzle-end", "three-quarter-left", "side-left", "iron-sight", "contact-grip-r", "contact-grip-l")


def require_absolute(options):
    for name in ("raw_root", "output_root", "evidence"):
        path = getattr(options, name)
        if not path.is_absolute():
            raise ValueError(f"{name} must be absolute: {path}")
    options.raw_root = options.raw_root.resolve()
    options.output_root = options.output_root.resolve()
    options.evidence = options.evidence.resolve()
    if options.output_root != EXPECTED_OUTPUT_ROOT.resolve():
        raise ValueError(f"unexpected output root: {options.output_root}")
    if options.evidence != EXPECTED_EVIDENCE_ROOT.resolve():
        raise ValueError(f"unexpected evidence root: {options.evidence}")


def require_inside(root: Path, path: Path) -> str:
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"path escapes root: {resolved}")
    return str(resolved)


def planned_paths(options, keys, motions) -> dict:
    candidates = {}
    for key in keys:
        target = options.output_root / key
        candidates[key] = {
            "glb": require_inside(options.output_root, target / "candidate.glb"),
            "blend": require_inside(options.output_root, target / "source.blend"),
            "metadata": require_inside(options.output_root, target / "metadata.json"),
            "renders": [
                require_inside(options.output_root, target / "renders" / f"{name}.png")
                for name in (*RENDER_NAMES, *(f"mechanism-{part}-{state}" for part in motions[key] for state in ("closed", "mid", "open")))
            ],
        }
    return {
        "schemaVersion": 1,
        "rawRoot": str(options.raw_root),
        "outputRoot": str(options.output_root),
        "evidenceRoot": str(options.evidence),
        "report": require_inside(options.evidence, options.evidence / "builder-report.json"),
        "candidates": candidates,
    }
