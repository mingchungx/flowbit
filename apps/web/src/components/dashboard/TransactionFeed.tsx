"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFeed, type FeedTransaction } from "@/hooks/useFeed";
import { formatUsdc, formatTimestamp } from "@/lib/format";

const ROW_HEIGHT = 24; // px per row (text-xs leading-6)
const OVERSCAN = 10; // extra rows to render above/below viewport

interface Props {
  walletId: string | null;
  selectedTxId: string | null;
  onSelectTx: (id: string | null) => void;
}

function TxLine({
  tx,
  selected,
  onClick,
  style,
}: {
  tx: FeedTransaction;
  selected: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  const isFund = tx.type === "fund";
  const colorClass = isFund
    ? "text-[var(--color-green)]"
    : "text-[var(--color-amber)]";
  const label = isFund ? "FUND" : "SEND";

  return (
    <div
      onClick={onClick}
      style={style}
      className={`flex items-baseline gap-2 px-4 cursor-pointer hover:bg-[var(--color-hover)] text-xs ${
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
  const { items, error, hasMore, loadingMore, loadMore } = useFeed(walletId);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Track viewport size
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to top on new items (if not paused)
  const prevCountRef = useRef(items.length);
  useEffect(() => {
    if (!paused && items.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevCountRef.current = items.length;
  }, [items.length, paused]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    // Infinite scroll: load more when near bottom
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < ROW_HEIGHT * 10 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  // Virtual scroll calculations
  const totalHeight = items.length * ROW_HEIGHT;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN
  );
  const visibleCount =
    Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">TRANSACTIONS</span>
          {walletId && (
            <span className="text-[var(--color-amber)]">filtered</span>
          )}
          {error && (
            <span className="text-[var(--color-red)]">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">
            {items.length} items
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="text-[var(--color-dim)] hover:text-[var(--color-fg)] cursor-pointer"
          >
            {paused ? "resume" : "pause"}
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-dim)]">
            no transactions yet
            <br />
            <span className="text-[10px]">
              fund a wallet or send a payment to see activity
            </span>
          </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleItems.map((tx, i) => (
              <TxLine
                key={tx.id}
                tx={tx}
                selected={selectedTxId === tx.id}
                onClick={() =>
                  onSelectTx(selectedTxId === tx.id ? null : tx.id)
                }
                style={{
                  position: "absolute",
                  top: (startIndex + i) * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                }}
              />
            ))}
          </div>
        )}
        {loadingMore && (
          <div className="px-4 py-2 text-center text-xs text-[var(--color-dim)]">
            loading...
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <div className="px-4 py-2 text-center text-xs text-[var(--color-dim)]">
            end of history
          </div>
        )}
      </div>
    </div>
  );
}
