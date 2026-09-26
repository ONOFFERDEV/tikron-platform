/** Metric relief in the existing opaque material. Every pattern reuses the
 * resident grain tile; derivative filtering keeps distant mortar/planks quiet. */
export const RELAY_FIELD_PATTERNS = {
  brick: `
    vec2 brickSize = vec2(0.38, 0.145);
    float course = floor(metres.y / brickSize.y);
    vec2 brickUv = metres + vec2(mod(course, 2.0) * brickSize.x * 0.5, 0.0);
    vec2 brickCell = floor(brickUv / brickSize);
    vec2 brickLocal = mod(brickUv, brickSize);
    vec2 brickEdge = min(brickLocal, brickSize - brickLocal);
    vec2 mortarEdge = 1.0 - smoothstep(vec2(0.006), vec2(0.009) + footprint, brickEdge);
    float brickDetail = 1.0 - smoothstep(0.035, 0.16, max(footprint.x, footprint.y));
    float mortar = max(mortarEdge.x, mortarEdge.y) * brickDetail;
    float fired = fract(sin(dot(brickCell, vec2(17.17, 91.71))) * 43758.5453);
    vec3 brickTint = mix(vec3(0.67, 0.57, 0.48), vec3(1.15, 1.04, 0.88), fired);
    diffuseColor.rgb *= mix(vec3(1.0), brickTint, vRelayWall * brickDetail);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.32, 1.40, 1.42), mortar * vRelayWall);
    fieldRelief = (1.0 - mortar) * 0.009 * vRelayWall * brickDetail;
    roughnessFactor = mix(roughnessFactor, 0.98, mortar);
  `,
  wood: `
    float boardWidth = 0.24;
    float board = floor(metres.x / boardWidth);
    vec2 boardUv = vec2(metres.x, metres.y + fract(board * 0.618) * 3.2);
    vec2 boardLocal = mod(boardUv, vec2(boardWidth, 3.2));
    vec2 boardEdge = min(boardLocal, vec2(boardWidth, 3.2) - boardLocal);
    vec2 boardSeam = 1.0 - smoothstep(vec2(0.003), vec2(0.007) + footprint, boardEdge);
    float timberDetail = 1.0 - smoothstep(0.04, 0.20, max(footprint.x, footprint.y));
    float joint = max(boardSeam.x, boardSeam.y) * timberDetail;
    float boardValue = fract(sin(board * 47.17) * 43758.5453);
    float fibre = texture2D(roughnessMap, vNormalMapUv * vec2(0.9, 0.012)).r;
    float grain = smoothstep(0.77, 0.87, fibre);
    diffuseColor.rgb *= mix(1.0, mix(0.84, 1.16, boardValue), timberDetail) * mix(0.87, 1.08, grain);
    diffuseColor.rgb *= 1.0 - joint * 0.44;
    fieldRelief = ((1.0 - joint) * 0.007 + grain * 0.002) * timberDetail;
    roughnessFactor = max(roughnessFactor, 0.84);
  `,
  earth: `
    float soil = texture2D(roughnessMap, vNormalMapUv * 0.065).r;
    float churn = smoothstep(0.76, 0.90, soil);
    diffuseColor.rgb *= mix(vec3(0.86, 0.82, 0.75), vec3(1.04, 1.02, 0.97), churn);
    roughnessFactor = mix(0.88, 0.99, churn);
    fieldRelief = churn * 0.004;
  `,
} as const;

export const RELAY_FIELD_RELIEF = `
  vec3 fieldDx = dFdx(-vViewPosition);
  vec3 fieldDy = dFdy(-vViewPosition);
  vec3 fieldRx = cross(fieldDy, normal);
  vec3 fieldRy = cross(normal, fieldDx);
  float fieldDet = dot(fieldDx, fieldRx);
  vec3 fieldGradient = sign(fieldDet) * (dFdx(fieldRelief) * fieldRx + dFdy(fieldRelief) * fieldRy);
  normal = normalize(abs(fieldDet) * normal - fieldGradient);
`;

/** Value noise for the Relay brick wear below; declared at file scope. */
export const RELAY_WEAR_FUNCTIONS = `
  float relayHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float relayNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(relayHash(i), relayHash(i + vec2(1.0, 0.0)), f.x),
      mix(relayHash(i + vec2(0.0, 1.0)), relayHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

/** Irregular damage, repairs and tone on the repeated brick cover kit. Runs after
 * RELAY_FIELD_PATTERNS.brick and reuses its brick cell. World-seeded, so twenty
 * identical 4 x 3 m boxes wear differently. Paint and relief only: silhouettes,
 * collision and AO are unchanged. Needs vRelayWorld, vRelayFaceNormal and
 * vRelayElevation (face bottom/top). */
export const RELAY_BRICK_WEAR = `
  if (vRelayWall > 0.5) {
    float faceExtent = vRelayElevation.y - vRelayElevation.x;
    float fromBase = vRelayHeight - vRelayElevation.x;
    float fromTop = vRelayElevation.y - vRelayHeight;
    // Along-wall coordinate is metres.x; the perpendicular one is constant per face.
    float facePlane = abs(vRelayFaceNormal.x) > abs(vRelayFaceNormal.z) ? vRelayWorld.x : vRelayWorld.z;
    float faceKey = floor(facePlane * 2.0 + 0.25) + (vRelayFaceNormal.x + vRelayFaceNormal.z > 0.0 ? 0.5 : 0.0);

    // Firing and weather differ wall to wall, with soot and old limewash remnants.
    float tone = relayNoise(vRelayWorld.xz / 7.0 + faceKey * 0.13);
    diffuseColor.rgb *= mix(vec3(0.76, 0.72, 0.68), vec3(1.12, 1.05, 0.95), tone);
    float wash = smoothstep(0.66, 0.82, relayNoise(vec2(metres.x * 0.35, faceKey * 0.71)))
      * smoothstep(0.45, 0.75, relayNoise(metres * vec2(1.3, 2.4) + 5.0)) * step(0.9, fromBase);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.30, 0.25), wash * 0.25);
    float soot = smoothstep(0.7, 0.9, relayNoise(vec2(metres.x * 0.5 + 9.0, faceKey)))
      * smoothstep(0.2, 1.0, fromBase / max(faceExtent, 0.5));
    diffuseColor.rgb *= 1.0 - soot * 0.45;

    // Collapsed top courses: a ragged, locally deeper broken edge on taller walls.
    float ragged = relayNoise(vec2(metres.x * 0.8, faceKey * 1.37));
    float lostRows = step(0.3, ragged) * (ragged - 0.3) * 14.0;
    float rowsDown = fromTop / brickSize.y + relayHash(brickCell + 3.7) * 1.3;
    float lost = step(1.0, faceExtent) * step(rowsDown, lostRows);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.30, 0.26, 0.22), lost);
    fieldRelief = mix(fieldRelief, -0.012, lost);

    // Shell and bullet scars: broken brick bowls with a pale spalled rim.
    vec2 scarCell = floor(metres / 1.5);
    float scarSeed = relayHash(scarCell + faceKey * 1.91);
    vec2 scarCentre = (scarCell + 0.25 + 0.5 * vec2(relayHash(scarCell + 1.7), relayHash(scarCell + 4.3))) * 1.5;
    float scarRadius = 0.26 + 0.44 * relayHash(scarCell + 9.1);
    float scarDist = length((metres - scarCentre) * vec2(1.0, 1.2)) / scarRadius
      + (relayNoise(metres * 11.0) - 0.5) * 0.55;
    float scarOn = step(0.77, scarSeed) * step(0.35, fromBase);
    float scarCore = scarOn * (1.0 - smoothstep(0.8, 1.0, scarDist));
    float scarRim = scarOn * smoothstep(0.8, 1.0, scarDist) * (1.0 - smoothstep(1.0, 1.7, scarDist));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.39, 0.34), scarCore);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.13, 1.04), scarRim * 0.6);
    fieldRelief = mix(fieldRelief, -0.014 * relayNoise(metres * 23.0), scarCore);

    // Field repairs over breaches: timber boards, corrugated iron or a sandbag plug.
    float segment = floor(metres.x / 2.6);
    float repairKey = relayHash(vec2(segment, faceKey * 0.37));
    float segLocal = metres.x - segment * 2.6;
    float repairW = 0.9 + relayHash(vec2(segment, faceKey) + 2.3) * 0.9;
    float repairH = 0.7 + relayHash(vec2(segment, faceKey) + 5.9) * 0.8;
    float plugged = repairKey < 0.24 ? 1.0 : 0.0;
    float repairBottom = repairKey < 0.17 ? 0.25 : 0.0;
    float inRepair = plugged * step(1.0, faceExtent)
      * step(0.3, segLocal) * step(segLocal, 0.3 + repairW)
      * step(repairBottom, fromBase) * step(fromBase, repairBottom + min(repairH, faceExtent - 0.3));
    vec3 repairColour = diffuseColor.rgb;
    float repairRelief = fieldRelief;
    if (repairKey < 0.1) {
      float board = floor(segLocal / 0.19);
      float boardEdge = min(fract(segLocal / 0.19), 1.0 - fract(segLocal / 0.19)) * 0.19;
      float seam = (1.0 - smoothstep(0.004, 0.008 + footprint.x, boardEdge)) * brickDetail;
      repairColour = vec3(0.10, 0.07, 0.045) * mix(0.75, 1.25, relayHash(vec2(board, segment) + faceKey));
      repairColour *= 1.0 - seam * 0.5;
      repairRelief = (1.0 - seam) * 0.008;
      roughnessFactor = mix(roughnessFactor, 0.9, inRepair);
    } else if (repairKey < 0.17) {
      float rib = sin(segLocal * 6.2831 / 0.076);
      float rust = smoothstep(0.45, 0.8, relayNoise(vec2(segLocal * 1.7, fromBase * 5.0) + segment));
      repairColour = mix(vec3(0.085, 0.08, 0.07), vec3(0.15, 0.075, 0.035), rust) * (0.85 + 0.15 * rib * brickDetail);
      repairRelief = rib * 0.004 * brickDetail;
      roughnessFactor = mix(roughnessFactor, 0.7, inRepair);
    } else {
      vec2 bagSize = vec2(0.6, 0.28);
      float bagRow = floor(fromBase / bagSize.y);
      vec2 bagLocal = mod(vec2(segLocal + mod(bagRow, 2.0) * 0.3, fromBase), bagSize) / bagSize;
      float pillow = 1.0 - pow(max(abs(bagLocal.x - 0.5), abs(bagLocal.y - 0.5)) * 2.0, 6.0);
      repairColour = vec3(0.19, 0.14, 0.075) * mix(0.5, 1.0, pillow)
        * mix(0.88, 1.1, relayHash(floor(vec2(segLocal + mod(bagRow, 2.0) * 0.3, fromBase) / bagSize) + faceKey));
      repairRelief = pillow * 0.02;
      roughnessFactor = mix(roughnessFactor, 0.98, inRepair);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, repairColour, inRepair);
    fieldRelief = mix(fieldRelief, repairRelief, inRepair);
  }
`;

/** Yard floor detail on top of the painted atlas: broad wet/dry tone, trodden
 * clods and scattered stones and brick fragments. metres is the planar world
 * projection, so it is continuous across the whole floor. Derivative-faded. */
export const RELAY_GROUND_DETAIL = `
  float groundDetail = 1.0 - smoothstep(0.03, 0.12, max(footprint.x, footprint.y));
  float tonal = relayNoise(metres / 13.0) * 0.5 + relayNoise(metres / 3.1 + 17.0) * 0.5;
  diffuseColor.rgb *= mix(vec3(0.93, 0.91, 0.88), vec3(1.06, 1.04, 0.98), tonal);
  float clods = relayNoise(metres * 1.3) * 0.6 + relayNoise(metres * 3.7) * 0.4;
  diffuseColor.rgb *= mix(1.0, mix(0.78, 1.10, clods), groundDetail);
  fieldRelief += (clods - 0.5) * 0.024 * groundDetail;
  vec2 stoneCell = floor(metres / 0.45);
  float stoneSeed = relayHash(stoneCell + 7.3);
  vec2 stoneLocal = fract(metres / 0.45) - 0.5 - (vec2(relayHash(stoneCell + 1.1), relayHash(stoneCell + 2.9)) - 0.5) * 0.5;
  float stone = step(0.84, stoneSeed) * (1.0 - smoothstep(0.07, 0.13, length(stoneLocal) * (0.8 + stoneSeed))) * groundDetail;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (stoneSeed > 0.93 ? vec3(1.30, 1.12, 0.98) : vec3(0.52, 0.50, 0.47)), stone);
  fieldRelief += stone * 0.012;
  // Low painted value is standing water / wet mud: a faint sheen, never a mirror.
  roughnessFactor = mix(roughnessFactor, 0.74, relayGroundWet);
`;
