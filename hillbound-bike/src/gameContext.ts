import type { Runtime } from "./runtime";

let runtime: Runtime | null = null;

export function setRuntime(value: Runtime): void {
  runtime = value;
}

export function getRuntime(): Runtime {
  if (!runtime) throw new Error("runtime not installed");
  return runtime;
}
