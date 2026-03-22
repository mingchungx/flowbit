"use client";
import { useState, useEffect } from "react";
import { TimelineBar } from "./TimelineBar";
import { AgentGraph } from "./AgentGraph";
import { EventFeed } from "./EventFeed";
import { Leaderboard } from "./Leaderboard";

export function SimulationDashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedAgentId(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex flex-col h-screen font-mono text-[var(--color-fg)] bg-[var(--color-bg)]">
      <div className="flex items-center">
        <div className="flex-1"><TimelineBar /></div>
        <button
          onClick={() => setDarkMode(d => !d)}
          className="px-4 py-2 text-xs text-[var(--color-dim)] hover:text-[var(--color-fg)] border-b border-[var(--color-border)] cursor-pointer"
        >
          {darkMode ? "light" : "dark"}
        </button>
      </div>
      <div className="flex-1 grid grid-cols-[3fr_2fr] min-h-0">
        <AgentGraph selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
        <div className="flex flex-col min-h-0 border-l border-[var(--color-border)]">
          <div className="flex-1 min-h-0">
            <EventFeed selectedAgentId={selectedAgentId} />
          </div>
          <Leaderboard selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
        </div>
      </div>
    </div>
  );
}
