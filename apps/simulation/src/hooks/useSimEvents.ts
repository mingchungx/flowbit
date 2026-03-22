"use client";
import { useState, useEffect, useRef } from "react";

export interface SimEvent {
  tick: number;
  agentId: number;
  agentName: string;
  type: string;
  detail: string;
  amount?: number;
  counterpartyId?: number;
  counterpartyName?: string;
}

const MAX_EVENTS = 1000;

export function useSimEvents() {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const source = new EventSource("/api/simulation/events");

    source.onopen = () => { if (mountedRef.current) setConnected(true); };

    source.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const batch: SimEvent[] = JSON.parse(e.data);
        setEvents(prev => [...batch, ...prev].slice(0, MAX_EVENTS));
      } catch { /* ignore parse errors */ }
    };

    source.onerror = () => { if (mountedRef.current) setConnected(false); };

    return () => { mountedRef.current = false; source.close(); };
  }, []);

  return { events, connected };
}
