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

export function useFeed(walletId?: string | null) {
  const [items, setItems] = useState<FeedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const seenIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  // Load initial page + start SSE
  useEffect(() => {
    mountedRef.current = true;
    seenIdsRef.current = new Set();
    cursorRef.current = null;
    setItems([]);
    setHasMore(true);
    setError(null);

    // 1. Load initial history page
    const params = new URLSearchParams({ limit: "50" });
    if (walletId) params.set("wallet_id", walletId);

    fetch(`/api/dashboard/feed?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (!mountedRef.current) return;
        const txs: FeedTransaction[] = json.transactions;
        for (const tx of txs) seenIdsRef.current.add(tx.id);
        setItems(txs);
        setHasMore(json.nextCursor !== null);
        cursorRef.current = json.nextCursor;
      })
      .catch((err) => {
        if (mountedRef.current) setError((err as Error).message);
      });

    // 2. Connect SSE for live updates
    const sseParams = new URLSearchParams();
    if (walletId) sseParams.set("wallet_id", walletId);
    const eventSource = new EventSource(
      `/api/dashboard/feed/stream?${sseParams}`
    );

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const tx: FeedTransaction = JSON.parse(event.data);
        if (seenIdsRef.current.has(tx.id)) return;
        seenIdsRef.current.add(tx.id);
        setItems((prev) => [tx, ...prev]);
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      if (mountedRef.current) setError("stream disconnected");
    };

    return () => {
      mountedRef.current = false;
      eventSource.close();
    };
  }, [walletId]);

  // Load more (scroll back through history)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        before: cursorRef.current,
        limit: "50",
      });
      if (walletId) params.set("wallet_id", walletId);

      const res = await fetch(`/api/dashboard/feed?${params}`);
      const json = await res.json();
      const txs: FeedTransaction[] = json.transactions;

      if (!mountedRef.current) return;

      const newTxs = txs.filter((tx) => !seenIdsRef.current.has(tx.id));
      for (const tx of newTxs) seenIdsRef.current.add(tx.id);

      setItems((prev) => [...prev, ...newTxs]);
      setHasMore(json.nextCursor !== null);
      cursorRef.current = json.nextCursor;
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [walletId, loadingMore, hasMore]);

  return { items, error, hasMore, loadingMore, loadMore };
}
