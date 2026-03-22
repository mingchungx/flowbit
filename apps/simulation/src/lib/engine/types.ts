export type RiskTolerance = "conservative" | "moderate" | "aggressive";

export type Profession =
  | "developer" | "designer" | "writer" | "data-analyst"
  | "security-auditor" | "accountant" | "chef" | "driver"
  | "doctor" | "lawyer" | "teacher" | "mechanic"
  | "plumber" | "electrician" | "photographer" | "musician"
  | "marketer" | "researcher" | "architect" | "therapist";

export interface AgentProfile {
  id: number;
  name: string;
  walletId: string;
  profession: Profession;
  riskTolerance: RiskTolerance;
  servicePrice: number;
  foodCost: number;          // 5-15
  housingCost: number;       // 50-200
  toolsCost: number;         // 10-50
  foodFrequency: number;     // days between food (~5-10)
  lastFoodDay: number;
  lastHousingDay: number;
  lastToolsDay: number;
  activeAgreementsAsPayee: string[];
  activeAgreementsAsPayer: string[];
}

export interface SimulationState {
  status: "idle" | "running" | "paused" | "completed";
  tick: number;
  speed: number;
  agents: AgentProfile[];
  totalTicks: number;        // 36500
  eventsBuffer: SimEvent[];
}

export interface SimEvent {
  tick: number;
  agentId: number;
  agentName: string;
  type: "buy_food" | "pay_housing" | "buy_tools" | "hire" | "get_hired"
      | "create_subscription" | "cancel_agreement" | "usage_report"
      | "settle" | "insufficient_funds" | "bankruptcy";
  detail: string;
  amount?: number;
  counterpartyId?: number;
  counterpartyName?: string;
}
