import { settleDueAgreements } from "@/lib/core/agreements";
import { evaluateAgent } from "./agent-logic";
import { Marketplace } from "./marketplace";
import { SeededRandom } from "./rng";
import { setupSimulation } from "./setup";
import type { SimulationState, SimEvent } from "./types";

export class SimulationRunner {
  state: SimulationState | null = null;
  private marketplace: Marketplace = new Marketplace();
  private rng: SeededRandom = new SeededRandom(42);
  private listeners = new Set<(events: SimEvent[]) => void>();
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  async init(seed: number = 42): Promise<void> {
    this.rng = new SeededRandom(seed);
    this.state = await setupSimulation(seed);
    this.marketplace = new Marketplace();
    for (const agent of this.state.agents) {
      this.marketplace.register(agent);
    }
  }

  start(): void {
    if (!this.state || this.running) return;
    this.state.status = "running";
    this.running = true;
    this.scheduleTick();
  }

  pause(): void {
    if (!this.state) return;
    this.state.status = "paused";
    this.running = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);
  }

  resume(): void {
    if (!this.state || this.running) return;
    this.state.status = "running";
    this.running = true;
    this.scheduleTick();
  }

  setSpeed(speed: number): void {
    if (this.state) this.state.speed = speed;
  }

  async reset(seed: number = 42): Promise<void> {
    this.pause();
    this.state = null;
    // Note: doesn't clean DB — old wallets/transactions remain
    await this.init(seed);
  }

  subscribe(listener: (events: SimEvent[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private scheduleTick(): void {
    if (!this.running || !this.state) return;
    const delay = Math.max(1, Math.floor(1000 / this.state.speed));
    this.tickTimer = setTimeout(() => this.executeTick(), delay);
  }

  private async executeTick(): Promise<void> {
    if (!this.state || !this.running) return;

    this.state.tick++;
    if (this.state.tick >= this.state.totalTicks) {
      this.state.status = "completed";
      this.running = false;
      return;
    }

    const events: SimEvent[] = [];
    const emitEvent = (event: Omit<SimEvent, "tick">) => {
      events.push({ ...event, tick: this.state!.tick });
    };

    // Process agents (sequentially to avoid DB lock contention)
    // Shuffle order each tick for fairness
    const order = this.rng.shuffle([...this.state.agents]);
    for (const agent of order) {
      await evaluateAgent(agent, this.state, this.marketplace, this.rng, this.state.agents, emitEvent);
    }

    // Settle due agreements every 7 days
    if (this.state.tick % 7 === 0) {
      try {
        const result = await settleDueAgreements();
        if (result.settled > 0) {
          events.push({
            tick: this.state.tick,
            agentId: -1,
            agentName: "SYSTEM",
            type: "settle",
            detail: `settled ${result.settled} agreements`,
          });
        }
      } catch {
        // Swallow settlement errors
      }
    }

    // Notify listeners
    if (events.length > 0) {
      this.state.eventsBuffer = events;
      for (const listener of this.listeners) {
        listener(events);
      }
    }

    // Schedule next tick
    this.scheduleTick();
  }
}
