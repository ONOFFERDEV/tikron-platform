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
