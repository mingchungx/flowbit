import type { AgreementInterval } from "./types";

export function computeNextDueAt(interval: AgreementInterval, from?: Date): Date {
  const base = from ?? new Date();
  const next = new Date(base);
  switch (interval) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setDate(next.getDate() + 30);
      break;
  }
  return next;
}
