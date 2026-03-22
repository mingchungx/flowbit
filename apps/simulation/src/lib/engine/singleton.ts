import { SimulationRunner } from "./runner";

let runner: SimulationRunner | null = null;

export function getRunner(): SimulationRunner {
  if (!runner) {
    runner = new SimulationRunner();
  }
  return runner;
}
