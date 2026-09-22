export type GlbAuditIssue = { readonly code: string; readonly path: string; readonly detail?: unknown };
export type GlbAuditResult = {
  readonly valid: boolean;
  readonly sha256: string;
  readonly metrics?: {
    readonly bytes: number;
    readonly triangles: number;
    readonly nodes: number;
    readonly lodTriangles?: readonly number[];
    readonly boreVector?: readonly number[];
    readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
  };
  readonly issues: readonly GlbAuditIssue[];
};
export function auditGlb(bytes: Uint8Array, options: { readonly role: string; readonly assetKey: string; readonly expectedSha256?: string; readonly requiredJoints?: readonly string[] }): GlbAuditResult;
export const WW1_WEAPON_PARTS: Readonly<Record<string, readonly string[]>>;
