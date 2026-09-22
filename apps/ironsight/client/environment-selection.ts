export function authoredEnvironmentEnabled(search: string): boolean {
  return new URLSearchParams(search).get("environment-candidates") !== "0";
}
