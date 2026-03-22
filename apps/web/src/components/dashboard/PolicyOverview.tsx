"use client";

import { useState } from "react";
import { usePoll } from "@/hooks/usePoll";

interface PolicyRow {
  id: string;
  walletId: string;
  walletName: string;
  type: string;
  params: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

function formatParams(type: string, params: Record<string, unknown>): string {
  switch (type) {
    case "max_per_tx":
      return `max ${params.max} per tx`;
    case "daily_limit":
      return `${params.limit}/day`;
    case "allowlist":
      return `${(params.allowed_wallets as string[])?.length || 0} allowed`;
    default:
      return JSON.stringify(params);
  }
}

export function PolicyOverview() {
  const { data: policies } = usePoll<PolicyRow[]>(
    "/api/dashboard/policies",
    10000
  );
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-[var(--color-border)]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs text-[var(--color-dim)] hover:text-[var(--color-fg)] cursor-pointer"
      >
        <span>
          POLICIES{" "}
          {policies && (
            <span className="text-[var(--color-fg)]">
              ({policies.length})
            </span>
          )}
        </span>
        <span>{expanded ? "collapse" : "expand"}</span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--color-border)] overflow-y-auto max-h-48">
          {!policies || policies.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-[var(--color-dim)]">
              no active policies
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-dim)] text-left">
                  <th className="px-4 py-1.5 font-normal">wallet</th>
                  <th className="px-4 py-1.5 font-normal">type</th>
                  <th className="px-4 py-1.5 font-normal">constraint</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-1.5 text-[var(--color-fg)]">
                      {p.walletName}
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-amber)]">
                      {p.type}
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-dim)]">
                      {formatParams(p.type, p.params)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
