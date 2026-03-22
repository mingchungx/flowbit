"use client";
import { usePoll } from "@/hooks/usePoll";

interface LeaderboardEntry {
  rank: number;
  name: string;
  profession: string;
  balance: string;
}

interface Props {
  selectedAgentId: number | null;
  onSelectAgent: (id: number | null) => void;
}

export function Leaderboard({ selectedAgentId, onSelectAgent }: Props) {
  const { data: raw } = usePoll<{ leaderboard: LeaderboardEntry[] } | LeaderboardEntry[]>("/api/simulation/leaderboard", 2000);
  const data = raw ? (Array.isArray(raw) ? raw : raw.leaderboard) : null;

  return (
    <div className="flex flex-col overflow-hidden border-t border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-dim)]">
        LEADERBOARD
      </div>
      <div className="flex-1 overflow-y-auto">
        {!data || data.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-dim)]">
            waiting for simulation...
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-dim)] text-left">
                <th className="px-3 py-1 font-normal w-8">#</th>
                <th className="px-3 py-1 font-normal">name</th>
                <th className="px-3 py-1 font-normal">profession</th>
                <th className="px-3 py-1 font-normal text-right">balance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => {
                const bal = parseFloat(entry.balance);
                const isBankrupt = bal < 1;
                const isTop3 = entry.rank <= 3;
                return (
                  <tr
                    key={entry.rank}
                    onClick={() => onSelectAgent(selectedAgentId === entry.rank - 1 ? null : entry.rank - 1)}
                    className={`border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-hover)] ${
                      selectedAgentId === entry.rank - 1 ? "bg-[var(--color-hover)]" : ""
                    }`}
                  >
                    <td className={`px-3 py-1 ${isTop3 ? "text-[var(--color-green)]" : "text-[var(--color-dim)]"}`}>
                      {entry.rank}
                    </td>
                    <td className={`px-3 py-1 ${isBankrupt ? "text-[var(--color-red)]" : "text-[var(--color-fg)]"}`}>
                      {entry.name}
                    </td>
                    <td className="px-3 py-1 text-[var(--color-dim)]">{entry.profession}</td>
                    <td className={`px-3 py-1 text-right ${
                      isBankrupt ? "text-[var(--color-red)]" : isTop3 ? "text-[var(--color-green)]" : "text-[var(--color-fg)]"
                    }`}>
                      {bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
