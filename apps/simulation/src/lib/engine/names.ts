export const AGENT_NAMES: string[] = Array.from(
  { length: 100 },
  (_, i) => `Agent-${String(i + 1).padStart(3, "0")}`
);
