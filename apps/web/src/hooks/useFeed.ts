"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface FeedTransaction {
  id: string;
  amount: string;
  memo: string | null;
  status: string;
  txHash: string | null;
  createdAt: string;
  type: "send" | "fund";
  fromWallet: { id: string; name: string } | null;
  toWallet: { id: string; name: string };
}

const MAX_ITEMS = 500;

export function useFeed(intervalMs: number, walletId?: string | null) {
  const [items, setItems] = useState<FeedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  const fetchFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sinceRef.current) params.set("since", sinceRef.current);
      if (walletId) params.set("wallet_id", walletId);
      params.set("limit", "50");

      const res = await fetch(`/api/dashboard/feed?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const newTxs: FeedTransaction[] = json.transactions;

      if (!mountedRef.current) return;

      if (newTxs.length > 0) {
        // Update cursor to the newest transaction
        const newest = newTxs.reduce((a, b) =>
          a.createdAt > b.createdAt ? a : b
        );
        sinceRef.current = newest.createdAt;

        setItems((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const unique = newTxs.filter((t) => !existingIds.has(t.id));
          const merged = [...unique, ...prev];
          return merged.slice(0, MAX_ITEMS);
        });
      }

      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, [walletId]);

  useEffect(() => {
    mountedRef.current = true;

    // Reset on wallet filter change
    if (initializedRef.current) {
      sinceRef.current = null;
      setItems([]);
    }
    initializedRef.current = true;

    fetchFeed();
    const id = setInterval(fetchFeed, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchFeed, intervalMs]);

  return { items, error };
}
