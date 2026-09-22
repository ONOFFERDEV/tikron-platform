# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Measured silhouettes and authored mechanisms for five WW1 weapons."""

import math

from geometry import box, cone, cylinder, join, profile, side_cylinder, side_torus, torus


def common_sights(parts, length, mats, detail):
    parts += [
        box("rear-sight-base", (0, 0.055, length * 0.53), (0.026, 0.012, 0.024), mats["steel"], 0.002),
        box("rear-sight-ear-left", (-0.012, 0.078, length * 0.54), (0.004, 0.026, 0.018), mats["steel"], 0.001),
        box("rear-sight-ear-right", (0.012, 0.078, length * 0.54), (0.004, 0.026, 0.018), mats["steel"], 0.001),
        box("front-sight-base", (0, 0.05, length * 0.93), (0.024, 0.012, 0.022), mats["steel"], 0.002),
        box("front-sight-blade", (0, 0.078, length * 0.94), (0.003, 0.025, 0.012), mats["steel"], 0.001),
    ]
    if detail:
        parts.append(cylinder("front-sight-pin", (0, 0.087, length * 0.94), 0.003, 0.018, mats["steel"], 12))


def trigger_group(parts, center, mats, scale=1.0):
    z, y = center
    parts += [
        side_torus("trigger-guard", (0, y, z), 0.031 * scale, 0.004 * scale, mats["steel"], 24),
        profile("trigger", [(z - 0.008 * scale, y + 0.018 * scale), (z + 0.006 * scale, y - 0.015 * scale),
                            (z + 0.014 * scale, y - 0.013 * scale), (z + 0.004 * scale, y + 0.020 * scale)],
                0.004 * scale, mats["steel_worn"], 0.001),
    ]


def bore(parts, z, y, radius, mats):
    parts.append(cylinder("bore-recess", (0, y, z), radius, 0.004, mats["black"], 24))


def rifle_stock(parts, length, mats, pistol_grip=False):
    start = 0.0
    end = length * 0.34
    points = [(start, 0.01), (length * 0.04, -0.045), (end * 0.7, -0.04), (end, -0.002),
              (end, 0.07), (end * 0.42, 0.095), (length * 0.03, 0.105)]
    parts.append(profile("walnut-buttstock", points, 0.045, mats["wood"], 0.008))
    parts.append(box("steel-buttplate", (0, 0.03, length * 0.012), (0.048, 0.075, 0.006), mats["steel_worn"], 0.004))
    if pistol_grip:
        points = [(end * 0.82, -0.01), (end * 0.98, -0.105), (end * 1.12, -0.12), (end * 1.17, -0.07), (end, 0.025)]
        parts.append(profile("integral-wrist", points, 0.035, mats["wood_dark"], 0.006))


def automatic_rifle(mats, detail=True):
    length = 1.18
    parts = []
    rifle_stock(parts, length, mats, True)
    parts += [
        box("rectangular-receiver", (0, 0.035, 0.51), (0.052, 0.055, 0.14), mats["steel"], 0.004),
        box("receiver-top-cover", (0, 0.092, 0.52), (0.047, 0.012, 0.12), mats["steel_worn"], 0.002),
        profile("walnut-fore-end", [(0.61, -0.035), (0.82, -0.025), (0.87, 0.02), (0.84, 0.065), (0.61, 0.07)], 0.045, mats["wood"], 0.006),
        cylinder("exposed-barrel", (0, 0.055, 0.99), 0.014, 0.37, mats["steel"], 32 if detail else 16),
        cylinder("gas-tube", (0, 0.018, 0.94), 0.009, 0.28, mats["steel_worn"], 20 if detail else 12),
        cone("muzzle-crown", (0, 0.055, 1.182), 0.018, 0.013, 0.025, mats["steel"], 24),
    ]
    common_sights(parts, length, mats, detail)
    trigger_group(parts, (0.39, -0.055), mats)
    bore(parts, 1.196, 0.055, 0.009, mats)
    if detail:
        for z in (0.405, 0.445, 0.485):
            parts.append(side_cylinder(f"receiver-pin-{z}", (0.054, 0.04, z), 0.005, 0.006, mats["brass"], 12))
        parts += [box("safety-lever", (0.058, 0.025, 0.43), (0.005, 0.012, 0.035), mats["steel_worn"], 0.002)]
    bolt = join([box("bolt-body", (0.049, 0.06, 0.55), (0.012, 0.012, 0.075), mats["steel_worn"], 0.002),
                 side_cylinder("bolt-handle", (0.064, 0.06, 0.50), 0.007, 0.035, mats["steel_worn"], 16)], "bolt")
    moving = {
        "magazine": profile("magazine", [(0.45, -0.04), (0.47, -0.19), (0.53, -0.19), (0.545, -0.04)], 0.035, mats["steel"], 0.004),
        "bolt": bolt,
    }
    sockets = {"grip_r": (0, -0.03, 0.36), "grip_l": (0, -0.01, 0.73), "muzzle": (0, 0.055, 1.195),
               "eject": (0.058, 0.045, 0.55), "sight_rear": (0, 0.105, 0.57), "sight_front": (0, 0.105, 1.11),
               "magwell": (0, -0.04, 0.50), "chamber": (0, 0.04, 0.65)}
    return parts, moving, sockets, length


def trench_smg(mats, detail=True):
    length = 0.81
    parts = []
    rifle_stock(parts, length, mats, True)
    parts += [
        box("receiver-wrist-block", (0, -0.005, 0.315), (0.038, 0.045, 0.065), mats["wood_dark"], 0.006),
        cylinder("tubular-receiver", (0, 0.035, 0.47), 0.046, 0.24, mats["steel"], 32 if detail else 16),
        cylinder("perforated-jacket", (0, 0.035, 0.66), 0.052, 0.20, mats["steel"], 32 if detail else 16),
        cylinder("barrel", (0, 0.035, 0.75), 0.012, 0.17, mats["black"], 24),
        torus("muzzle-ring", (0, 0.035, 0.805), 0.048, 0.005, mats["steel"], 24),
    ]
    common_sights(parts, length, mats, detail)
    trigger_group(parts, (0.285, -0.07), mats, 0.9)
    bore(parts, 0.817, 0.035, 0.008, mats)
    if detail:
        for row in (-0.051, 0.051):
            for z in (0.59, 0.63, 0.67, 0.71):
                parts.append(side_cylinder(f"jacket-port-{row}-{z}", (row, 0.035, z), 0.008, 0.006, mats["black"], 12))
        parts += [box("charging-slot", (0.046, 0.042, 0.47), (0.006, 0.013, 0.065), mats["black"], 0.001)]
    bolt = join([cylinder("bolt-body", (0, 0.035, 0.49), 0.037, 0.11, mats["steel_worn"], 24),
                 side_cylinder("charging-handle", (0.055, 0.045, 0.46), 0.008, 0.045, mats["steel_worn"], 16)], "bolt")
    moving = {
        "magazine": profile("magazine", [(0.43, -0.02), (0.445, -0.19), (0.49, -0.19), (0.505, -0.02)], 0.028, mats["steel"], 0.003),
        "bolt": bolt,
    }
    sockets = {"grip_r": (0, -0.04, 0.30), "grip_l": (0, -0.005, 0.62), "muzzle": (0, 0.035, 0.82),
               "eject": (0.05, 0.045, 0.50), "sight_rear": (0, 0.10, 0.43), "sight_front": (0, 0.10, 0.75),
               "magwell": (0, -0.03, 0.47), "chamber": (0, 0.035, 0.56)}
    return parts, moving, sockets, length


def pump_shotgun(mats, detail=True):
    length = 1.05
    parts = []
    rifle_stock(parts, length, mats, False)
    parts += [
        box("open-top-receiver", (0, 0.035, 0.47), (0.052, 0.052, 0.12), mats["steel"], 0.004),
        cylinder("barrel", (0, 0.065, 0.79), 0.014, 0.52, mats["steel"], 32 if detail else 16),
        cylinder("magazine-tube", (0, 0.018, 0.76), 0.013, 0.43, mats["steel_worn"], 28 if detail else 14),
        cone("muzzle-crown", (0, 0.065, 1.055), 0.019, 0.014, 0.025, mats["steel"], 24),
        box("external-hammer", (0, 0.088, 0.355), (0.016, 0.018, 0.016), mats["steel_worn"], 0.003),
    ]
    common_sights(parts, length, mats, detail)
    trigger_group(parts, (0.39, -0.045), mats)
    bore(parts, 1.068, 0.065, 0.010, mats)
    pump_bits = [cylinder("pump-body", (0, 0.005, 0.69), 0.047, 0.20, mats["wood_dark"], 32 if detail else 16)]
    if detail:
        for z in (0.62, 0.655, 0.69, 0.725, 0.76):
            pump_bits.append(torus(f"pump-rib-{z}", (0, 0.005, z), 0.048, 0.0025, mats["wood"], 24))
    moving = {
        "pump": join(pump_bits, "pump"),
        "shell": cylinder("shell", (0.033, -0.015, 0.48), 0.010, 0.065, mats["brass"], 16),
    }
    if detail:
        parts.append(box("loading-port", (0, -0.02, 0.48), (0.032, 0.006, 0.052), mats["black"], 0.002))
    sockets = {"grip_r": (0, -0.03, 0.34), "grip_l": (0, -0.015, 0.69), "muzzle": (0, 0.065, 1.07),
               "eject": (0.058, 0.04, 0.50), "sight_rear": (0, 0.105, 0.47), "sight_front": (0, 0.105, 0.98),
               "chamber": (0, 0.035, 0.57)}
    return parts, moving, sockets, length


def bolt_service_rifle(mats, detail=True):
    length = 1.24
    parts = []
    rifle_stock(parts, length, mats, False)
    parts += [
        profile("full-length-stock", [(0.30, -0.04), (0.98, -0.035), (1.01, 0.015), (0.96, 0.065), (0.30, 0.075)], 0.038, mats["wood"], 0.006),
        box("receiver", (0, 0.055, 0.58), (0.043, 0.052, 0.13), mats["steel"], 0.004),
        cylinder("exposed-barrel", (0, 0.07, 1.05), 0.012, 0.39, mats["steel"], 32 if detail else 16),
        box("charger-bridge", (0, 0.112, 0.61), (0.05, 0.018, 0.025), mats["steel"], 0.002),
        cone("muzzle-crown", (0, 0.07, 1.245), 0.017, 0.012, 0.023, mats["steel"], 24),
    ]
    common_sights(parts, length, mats, detail)
    trigger_group(parts, (0.37, -0.035), mats)
    bore(parts, 1.258, 0.07, 0.008, mats)
    bolt_bits = [cylinder("bolt-body", (0, 0.068, 0.56), 0.018, 0.22, mats["steel_worn"], 24)]
    if detail:
        bolt_bits.append(side_cylinder("bolt-handle", (0.07, 0.045, 0.50), 0.008, 0.08, mats["steel_worn"], 16))
        parts.append(torus("nose-band", (0, 0.05, 0.94), 0.046, 0.006, mats["steel"], 24))
    clip_bits = [profile("clip-body", [(0.588, 0.11), (0.588, 0.15), (0.632, 0.15), (0.632, 0.11)], 0.035, mats["brass"], 0.002)]
    for x in (-0.024, -0.012, 0, 0.012, 0.024):
        clip_bits.append(cylinder(f"clip-round-{x}", (x, 0.16, 0.61), 0.004, 0.035, mats["brass"], 10))
    moving = {"bolt": join(bolt_bits, "bolt"), "clip": join(clip_bits, "clip")}
    sockets = {"grip_r": (0, -0.02, 0.34), "grip_l": (0, -0.005, 0.78), "muzzle": (0, 0.07, 1.26),
               "eject": (0.052, 0.065, 0.61), "sight_rear": (0, 0.13, 0.58), "sight_front": (0, 0.12, 1.15),
               "chamber": (0, 0.06, 0.69), "clip_mount": (0, 0.135, 0.61)}
    return parts, moving, sockets, length


def service_pistol(mats, detail=True):
    length = 0.218
    parts = [
        profile("grip-frame", [(0.015, -0.12), (0.072, -0.115), (0.105, -0.012), (0.035, -0.003)], 0.024, mats["wood"], 0.004),
        box("steel-frame", (0, 0.008, 0.115), (0.017, 0.025, 0.095), mats["steel"], 0.003),
        cylinder("barrel", (0, 0.030, 0.155), 0.009, 0.105, mats["black"], 24),
        box("hammer", (0, 0.048, 0.035), (0.014, 0.018, 0.015), mats["steel_worn"], 0.002),
    ]
    trigger_group(parts, (0.105, -0.022), mats, 0.75)
    bore(parts, 0.224, 0.030, 0.006, mats)
    slide_bits = [box("slide-body", (0, 0.043, 0.132), (0.020, 0.022, 0.088), mats["steel_worn"], 0.003),
                  box("front-sight", (0, 0.063, 0.198), (0.003, 0.010, 0.006), mats["steel"], 0.001),
                  box("rear-sight-left", (-0.008, 0.063, 0.055), (0.004, 0.010, 0.006), mats["steel"], 0.001),
                  box("rear-sight-right", (0.008, 0.063, 0.055), (0.004, 0.010, 0.006), mats["steel"], 0.001)]
    if detail:
        for z in (0.045, 0.055, 0.065, 0.075):
            slide_bits.append(box(f"slide-serration-{z}", (0.019, 0.045, z), (0.002, 0.012, 0.002), mats["black"], 0))
        parts += [side_cylinder("safety-pin", (0.021, 0.022, 0.072), 0.004, 0.005, mats["brass"], 12),
                  side_cylinder("grip-screw", (0.024, -0.055, 0.061), 0.004, 0.004, mats["brass"], 12)]
        slide_bits.append(box("ejection-port", (0.0205, 0.047, 0.145), (0.002, 0.012, 0.026), mats["black"], 0.001))
    moving = {
        "slide": join(slide_bits, "slide"),
        "magazine": box("magazine", (0, -0.055, 0.052), (0.014, 0.044, 0.018), mats["steel"], 0.002),
    }
    sockets = {"grip_r": (0, -0.055, 0.052), "grip_l": (0, -0.01, 0.08), "muzzle": (0, 0.043, 0.225),
               "eject": (0.022, 0.045, 0.13), "sight_rear": (0, 0.075, 0.055), "sight_front": (0, 0.075, 0.198),
               "magwell": (0, -0.08, 0.052), "chamber": (0, 0.043, 0.16)}
    return parts, moving, sockets, length


BUILDERS = {
    "automatic_rifle": automatic_rifle,
    "trench_smg": trench_smg,
    "pump_shotgun": pump_shotgun,
    "bolt_service_rifle": bolt_service_rifle,
    "service_pistol": service_pistol,
}
