import type { Profession, AgentProfile } from "./types";
import type { SeededRandom } from "./rng";

export class Marketplace {
  private byProfession = new Map<Profession, AgentProfile[]>();

  register(agent: AgentProfile): void {
    const list = this.byProfession.get(agent.profession) ?? [];
    list.push(agent);
    this.byProfession.set(agent.profession, list);
  }

  findProvider(profession: Profession, excludeId: number, rng: SeededRandom): AgentProfile | null {
    const providers = this.byProfession.get(profession)?.filter(a => a.id !== excludeId);
    if (!providers?.length) return null;
    return rng.pick(providers);
  }

  findCheapest(profession: Profession, excludeId: number): AgentProfile | null {
    const providers = this.byProfession.get(profession)?.filter(a => a.id !== excludeId);
    if (!providers?.length) return null;
    return providers.reduce((a, b) => a.servicePrice < b.servicePrice ? a : b);
  }
}
