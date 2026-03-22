"use client";

import { usePoll } from "@/hooks/usePoll";
import { formatUsdc, relativeTime } from "@/lib/format";

interface OverviewData {
  totalWallets: number;
  totalBalance: string;
  transactionsLast24h: number;
  transactionsLastHour: number;
  activePolicies: number;
  lastActivityAt: string | null;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[var(--color-dim)]">{label}</span>
      <span className="text-[var(--color-fg)]">{value}</span>
    </div>
  );
}

export function StatusBar() {
  const { data } = usePoll<OverviewData>("/api/dashboard/overview", 5000);

  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-green)] animate-pulse" />
          <span className="text-[var(--color-dim)]">FLOWBIT</span>
        </div>
        {data && (
          <>
            <Stat label="wallets" value={data.totalWallets} />
            <Stat label="balance" value={`${formatUsdc(data.totalBalance)} USDC`} />
            <Stat label="tx/1h" value={data.transactionsLastHour} />
            <Stat label="tx/24h" value={data.transactionsLast24h} />
            <Stat label="policies" value={data.activePolicies} />
          </>
        )}
      </div>
      <div className="text-[var(--color-dim)]">
        {data?.lastActivityAt
          ? `last activity ${relativeTime(data.lastActivityAt)}`
          : "no activity"}
      </div>
    </div>
  );
}
