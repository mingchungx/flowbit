"use client";

import { usePoll } from "@/hooks/usePoll";
import { truncateAddress, formatUsdc } from "@/lib/format";

interface Wallet {
  id: string;
  name: string;
  address: string;
  currency: string;
  balance: string;
}

interface Props {
  selectedWalletId: string | null;
  onSelectWallet: (id: string | null) => void;
}

export function WalletTable({ selectedWalletId, onSelectWallet }: Props) {
  const { data: wallets } = usePoll<Wallet[]>("/api/wallets", 5000);

  return (
    <div className="flex flex-col border-r border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <span className="text-[var(--color-dim)]">WALLETS</span>
        {selectedWalletId && (
          <button
            onClick={() => onSelectWallet(null)}
            className="text-[var(--color-dim)] hover:text-[var(--color-fg)] cursor-pointer"
          >
            clear filter
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!wallets || wallets.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-dim)]">
            no wallets yet
            <br />
            <span className="text-[10px]">
              use the CLI or API to create one
            </span>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-dim)] text-left">
                <th className="px-4 py-1.5 font-normal">name</th>
                <th className="px-4 py-1.5 font-normal">address</th>
                <th className="px-4 py-1.5 font-normal text-right">balance</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr
                  key={w.id}
                  onClick={() =>
                    onSelectWallet(
                      selectedWalletId === w.id ? null : w.id
                    )
                  }
                  className={`cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-hover)] ${
                    selectedWalletId === w.id
                      ? "bg-[var(--color-hover)]"
                      : ""
                  }`}
                >
                  <td className="px-4 py-1.5 text-[var(--color-fg)]">
                    {w.name}
                  </td>
                  <td className="px-4 py-1.5 text-[var(--color-dim)]">
                    {truncateAddress(w.address)}
                  </td>
                  <td className="px-4 py-1.5 text-right text-[var(--color-fg)]">
                    {formatUsdc(w.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
