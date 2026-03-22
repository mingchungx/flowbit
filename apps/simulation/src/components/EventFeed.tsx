"use client";
import { useState, useRef, useEffect } from "react";
import { useSimEvents } from "@/hooks/useSimEvents";

interface Props {
  selectedAgentId: number | null;
}

const typeColors: Record<string, string> = {
  buy_food: "text-[var(--color-dim)]",
  pay_housing: "text-[var(--color-dim)]",
  buy_tools: "text-[var(--color-dim)]",
  hire: "text-[var(--color-amber)]",
  get_hired: "text-[var(--color-green)]",
  create_subscription: "text-[var(--color-green)]",
  cancel_agreement: "text-[var(--color-red)]",
  usage_report: "text-[var(--color-dim)]",
  settle: "text-[var(--color-green)]",
  insufficient_funds: "text-[var(--color-red)]",
  bankruptcy: "text-[var(--color-red)]",
};

function formatTick(tick: number): string {
  const year = Math.floor(tick / 365);
  const day = tick % 365;
  return `Y${String(year).padStart(3, "0")} D${String(day).padStart(3, "0")}`;
}

export function EventFeed({ selectedAgentId }: Props) {
  const { events, connected } = useSimEvents();
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter events if an agent is selected
  const filtered = selectedAgentId !== null
    ? events.filter(e => e.agentId === selectedAgentId || e.counterpartyId === selectedAgentId)
    : events;

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filtered.length, paused]);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">EVENTS</span>
          {!connected && <span className="text-[var(--color-red)]">disconnected</span>}
          {selectedAgentId !== null && <span className="text-[var(--color-amber)]">filtered</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-dim)]">{filtered.length}</span>
          <button
            onClick={() => setPaused(p => !p)}
            className="text-[var(--color-dim)] hover:text-[var(--color-fg)] cursor-pointer"
          >
            {paused ? "resume" : "pause"}
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-dim)]">
            waiting for events...
          </div>
        ) : (
          filtered.slice(0, 200).map((event, i) => (
            <div key={`${event.tick}-${event.agentId}-${event.type}-${i}`}
              className="flex items-baseline gap-2 px-4 py-0.5 text-xs leading-5"
            >
              <span className="text-[var(--color-dim)] shrink-0">[{formatTick(event.tick)}]</span>
              <span className={`shrink-0 w-16 ${typeColors[event.type] || "text-[var(--color-fg)]"}`}>
                {event.type.replace(/_/g, " ").toUpperCase().slice(0, 12)}
              </span>
              {event.amount && (
                <span className="text-[var(--color-fg)] shrink-0 w-16 text-right">
                  {event.amount.toFixed(2)}
                </span>
              )}
              <span className="text-[var(--color-fg)] shrink-0">{event.agentName}</span>
              {event.counterpartyName && (
                <>
                  <span className="text-[var(--color-dim)]">{"\u2192"}</span>
                  <span className="text-[var(--color-fg)]">{event.counterpartyName}</span>
                </>
              )}
              <span className="text-[var(--color-dim)] truncate">{event.detail}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
