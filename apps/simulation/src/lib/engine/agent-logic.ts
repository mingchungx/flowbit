import { sendPayment, getWallet, InsufficientFundsError } from "@/lib/core/ledger";
import { createAgreement, reportUsage, cancelAgreement } from "@/lib/core/agreements";
import { Marketplace } from "./marketplace";
import { SeededRandom } from "./rng";
import { PROFESSIONS } from "./professions";
import type { AgentProfile, Profession, SimEvent, SimulationState } from "./types";

export async function evaluateAgent(
  agent: AgentProfile,
  state: SimulationState,
  marketplace: Marketplace,
  rng: SeededRandom,
  allAgents: AgentProfile[],
  emitEvent: (event: Omit<SimEvent, "tick">) => void,
): Promise<void> {
  const tick = state.tick;

  // Get current balance
  let wallet;
  try {
    wallet = await getWallet(agent.walletId);
  } catch {
    return;
  }
  const balance = parseFloat(wallet.balance);

  // Bankruptcy check
  if (balance < 1) {
    emitEvent({
      agentId: agent.id,
      agentName: agent.name,
      type: "bankruptcy",
      detail: `balance: ${balance.toFixed(2)}`,
    });
    return; // can't do anything
  }

  // 1. Food (every foodFrequency days)
  if (tick - agent.lastFoodDay >= agent.foodFrequency && balance >= agent.foodCost) {
    const chef = marketplace.findProvider("chef", agent.id, rng);
    if (chef) {
      try {
        await sendPayment({
          from: agent.walletId,
          to: chef.walletId,
          amount: agent.foodCost,
          idempotencyKey: `sim_food_${agent.id}_${tick}`,
          memo: "food",
        });
        agent.lastFoodDay = tick;
        emitEvent({
          agentId: agent.id,
          agentName: agent.name,
          type: "buy_food",
          detail: `bought food from ${chef.name}`,
          amount: agent.foodCost,
          counterpartyId: chef.id,
          counterpartyName: chef.name,
        });
      } catch (e) {
        if (e instanceof InsufficientFundsError) {
          emitEvent({
            agentId: agent.id,
            agentName: agent.name,
            type: "insufficient_funds",
            detail: "can't afford food",
          });
        }
      }
    }
  }

  // 2. Housing (every 30 days)
  if (tick - agent.lastHousingDay >= 30 && balance >= agent.housingCost) {
    const housingProfessions: Profession[] = ["architect", "plumber", "electrician"];
    const profession = rng.pick(housingProfessions);
    const landlord = marketplace.findProvider(profession, agent.id, rng);
    if (landlord) {
      try {
        await sendPayment({
          from: agent.walletId,
          to: landlord.walletId,
          amount: agent.housingCost,
          idempotencyKey: `sim_housing_${agent.id}_${tick}`,
          memo: "housing",
        });
        agent.lastHousingDay = tick;
        emitEvent({
          agentId: agent.id,
          agentName: agent.name,
          type: "pay_housing",
          detail: `paid housing to ${landlord.name}`,
          amount: agent.housingCost,
          counterpartyId: landlord.id,
          counterpartyName: landlord.name,
        });
      } catch (e) {
        if (e instanceof InsufficientFundsError) {
          emitEvent({
            agentId: agent.id,
            agentName: agent.name,
            type: "insufficient_funds",
            detail: "can't afford housing",
          });
        }
      }
    }
  }

  // 3. Tools (every ~60-120 days, random)
  if (tick - agent.lastToolsDay >= rng.nextInt(60, 120) && balance >= agent.toolsCost) {
    const toolProvider = marketplace.findProvider(
      rng.pick(["developer", "mechanic", "electrician"] as Profession[]),
      agent.id,
      rng,
    );
    if (toolProvider) {
      try {
        await sendPayment({
          from: agent.walletId,
          to: toolProvider.walletId,
          amount: agent.toolsCost,
          idempotencyKey: `sim_tools_${agent.id}_${tick}`,
          memo: "tools",
        });
        agent.lastToolsDay = tick;
        emitEvent({
          agentId: agent.id,
          agentName: agent.name,
          type: "buy_tools",
          detail: `bought tools from ${toolProvider.name}`,
          amount: agent.toolsCost,
          counterpartyId: toolProvider.id,
          counterpartyName: toolProvider.name,
        });
      } catch {
        // Swallow — not critical
      }
    }
  }

  // 4. Hire someone (probability-based, higher when wealthy)
  const hireProbability =
    agent.riskTolerance === "aggressive" ? 0.15
    : agent.riskTolerance === "moderate" ? 0.08
    : 0.04;

  if (rng.chance(hireProbability) && balance > 100) {
    const myConfig = PROFESSIONS.find(p => p.name === agent.profession)!;
    const neededProfession = rng.pick(myConfig.needs);
    const provider =
      agent.riskTolerance === "conservative"
        ? marketplace.findCheapest(neededProfession, agent.id)
        : marketplace.findProvider(neededProfession, agent.id, rng);

    if (provider) {
      // Decide payment type based on risk tolerance
      if (
        agent.riskTolerance === "aggressive" &&
        rng.chance(0.3) &&
        balance > provider.servicePrice * 4
      ) {
        // Create subscription (weekly)
        try {
          const agreement = await createAgreement({
            payerWalletId: agent.walletId,
            payeeWalletId: provider.walletId,
            type: "subscription",
            amount: provider.servicePrice,
            interval: "weekly",
          });
          agent.activeAgreementsAsPayer.push(agreement.id);
          provider.activeAgreementsAsPayee.push(agreement.id);
          emitEvent({
            agentId: agent.id,
            agentName: agent.name,
            type: "create_subscription",
            detail: `subscription with ${provider.name} (${neededProfession})`,
            amount: provider.servicePrice,
            counterpartyId: provider.id,
            counterpartyName: provider.name,
          });
        } catch {
          // Swallow
        }
      } else if (
        agent.riskTolerance === "moderate" &&
        rng.chance(0.2) &&
        balance > provider.servicePrice * 2
      ) {
        // Create usage agreement
        try {
          const agreement = await createAgreement({
            payerWalletId: agent.walletId,
            payeeWalletId: provider.walletId,
            type: "usage",
            amount: provider.servicePrice / 10, // per-unit rate
            unit: "task",
            interval: "weekly",
          });
          agent.activeAgreementsAsPayer.push(agreement.id);
          provider.activeAgreementsAsPayee.push(agreement.id);
          emitEvent({
            agentId: agent.id,
            agentName: agent.name,
            type: "create_subscription",
            detail: `usage agreement with ${provider.name}`,
            amount: provider.servicePrice / 10,
            counterpartyId: provider.id,
            counterpartyName: provider.name,
          });
        } catch {
          // Swallow
        }
      } else {
        // One-time payment
        try {
          await sendPayment({
            from: agent.walletId,
            to: provider.walletId,
            amount: provider.servicePrice,
            idempotencyKey: `sim_hire_${agent.id}_${tick}_${rng.nextInt(0, 99999)}`,
            memo: `hired ${neededProfession}`,
          });
          emitEvent({
            agentId: agent.id,
            agentName: agent.name,
            type: "hire",
            detail: `hired ${provider.name} (${neededProfession})`,
            amount: provider.servicePrice,
            counterpartyId: provider.id,
            counterpartyName: provider.name,
          });
        } catch {
          // Swallow
        }
      }
    }
  }

  // 5. Report usage on active usage agreements (as payer)
  for (const agreementId of agent.activeAgreementsAsPayer) {
    if (rng.chance(0.3)) {
      // 30% chance per tick to use the service
      try {
        await reportUsage(agreementId, rng.nextInt(1, 5));
        emitEvent({
          agentId: agent.id,
          agentName: agent.name,
          type: "usage_report",
          detail: `reported usage on agreement ${agreementId.slice(0, 8)}`,
        });
      } catch {
        // Agreement might be cancelled/completed, remove it
        agent.activeAgreementsAsPayer = agent.activeAgreementsAsPayer.filter(
          id => id !== agreementId,
        );
      }
    }
  }

  // 6. Cancel expensive agreements when running low
  if (balance < 200 && agent.activeAgreementsAsPayer.length > 0 && rng.chance(0.2)) {
    const toCancel = rng.pick(agent.activeAgreementsAsPayer);
    try {
      await cancelAgreement(toCancel);
      agent.activeAgreementsAsPayer = agent.activeAgreementsAsPayer.filter(
        id => id !== toCancel,
      );
      emitEvent({
        agentId: agent.id,
        agentName: agent.name,
        type: "cancel_agreement",
        detail: `cancelled agreement ${toCancel.slice(0, 8)} (low funds)`,
      });
    } catch {
      // Swallow
    }
  }
}
