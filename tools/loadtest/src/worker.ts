import { parentPort, workerData } from "node:worker_threads";
import type { Config } from "./cli.js";
import { runShard, type ClientSpec, type ShardResult } from "./runner.js";

/** worker_threads entry: run this shard's client slice and post the result back. */
interface WorkerInput {
  config: Config;
  specs: ClientSpec[];
}

async function main(): Promise<void> {
  const port = parentPort;
  if (!port) throw new Error("worker.ts must be run as a worker thread");
  const input = workerData as WorkerInput;
  // Workers never run the lag probe — only the main thread self-checks the loop.
  const result: ShardResult = await runShard(input.config, input.specs, false);
  port.postMessage(result);
}

void main();
