"use client";

import { useState, useRef, useEffect } from "react";
import { useFeed, type FeedTransaction } from "@/hooks/useFeed";
import { formatUsdc, formatTimestamp } from "@/lib/format";

interface Props {
  walletId: string | null;
  selectedTxId: string | null;
  onSelectTx: (id: string | null) => void;
}

function TxLine({
  tx,
  selected,
  onClick,
}: {
  tx: FeedTransaction;
  selected: boolean;
  onClick: () => void;
}) {
  const isFund = tx.type === "fund";
  const colorClass = isFund
    ? "text-[var(--color-green)]"
    : "text-[var(--color-amber)]";
  const label = isFund ? "FUND" : "SEND";

  return (
    <div
      onClick={onClick}
      className={`flex items-baseline gap-2 px-4 py-0.5 cursor-pointer hover:bg-[var(--color-hover)] text-xs leading-5 ${
        selected ? "bg-[var(--color-hover)]" : ""
      }`}
    >
      <span className="text-[var(--color-dim)] shrink-0">
        [{formatTimestamp(tx.createdAt)}]
      </span>
      <span className={`${colorClass} shrink-0 w-10`}>{label}</span>
      <span className="text-[var(--color-fg)] shrink-0 w-20 text-right">
        {formatUsdc(tx.amount)}
      </span>
      <span className="text-[var(--color-dim)] shrink-0">USDC</span>
      <span className="text-[var(--color-dim)] truncate">
        {isFund ? (
          <>
            {"→ "}
            <span className="text-[var(--color-fg)]">{tx.toWallet.name}</span>
          </>
        ) : (
          <>
            <span className="text-[var(--color-fg)]">
              {tx.fromWallet?.name}
            </span>
            {" → "}
            <span className="text-[var(--color-fg)]">{tx.toWallet.name}</span>
          </>
        )}
      </span>
      {tx.memo && (
        <span className="text-[var(--color-dim)] truncate italic">
          {tx.memo}
        </span>
      )}
    </div>
  );
}

export function TransactionFeed({ walletId, selectedTxId, onSelectTx }: Props) {
  const { items, error } = useFeed(3000, walletId);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [items, paused]);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">TRANSACTIONS</span>
          {walletId && (
            <span className="text-[var(--color-amber)]">filtered</span>
          )}
          {error && (
            <span className="text-[var(--color-red)]">error: {error}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">{items.length} items</span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="text-[var(--color-dim)] hover:text-[var(--color-fg)] cursor-pointer"
          >
            {paused ? "resume" : "pause"}
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-dim)]">
            no transactions yet
            <br />
            <span className="text-[10px]">
              fund a wallet or send a payment to see activity
            </span>
          </div>
        ) : (
          items.map((tx) => (
            <TxLine
              key={tx.id}
              tx={tx}
              selected={selectedTxId === tx.id}
              onClick={() =>
                onSelectTx(selectedTxId === tx.id ? null : tx.id)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
