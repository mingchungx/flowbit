import { createWallet, fundWallet } from "@/lib/core/ledger";
import { PROFESSIONS } from "./professions";
import { SeededRandom } from "./rng";
import { AGENT_NAMES } from "./names";
import type { AgentProfile, RiskTolerance, SimulationState } from "./types";

export async function setupSimulation(seed: number = 42): Promise<SimulationState> {
  const rng = new SeededRandom(seed);
  const agents: AgentProfile[] = [];

  for (let i = 0; i < 100; i++) {
    const professionIndex = i % 20; // 5 agents per profession
    const profConfig = PROFESSIONS[professionIndex];

    const wallet = await createWallet(AGENT_NAMES[i]);
    await fundWallet(wallet.id, 1000, `sim_fund_${wallet.id}`);

    const riskOptions: RiskTolerance[] = ["conservative", "moderate", "aggressive"];

    agents.push({
      id: i,
      name: AGENT_NAMES[i],
      walletId: wallet.id,
      profession: profConfig.name,
      riskTolerance: riskOptions[i % 3],
      servicePrice: rng.nextInt(profConfig.priceRange[0], profConfig.priceRange[1]),
      foodCost: rng.nextInt(5, 15),
      housingCost: rng.nextInt(50, 200),
      toolsCost: rng.nextInt(10, 50),
      foodFrequency: rng.nextInt(5, 10),
      lastFoodDay: -100,
      lastHousingDay: -100,
      lastToolsDay: -100,
      activeAgreementsAsPayee: [],
      activeAgreementsAsPayer: [],
    });
  }

  return {
    status: "idle",
    tick: 0,
    speed: 10,
    agents,
    totalTicks: 36500,
    eventsBuffer: [],
  };
}
