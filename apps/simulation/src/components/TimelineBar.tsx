"use client";
import { usePoll } from "@/hooks/usePoll";

interface SimState {
  status: string;
  tick: number;
  speed: number;
  totalTicks: number;
  agentCount: number;
}

export function TimelineBar() {
  const { data } = usePoll<SimState>("/api/simulation", 1000);

  const year = data ? Math.floor(data.tick / 365) : 0;
  const day = data ? data.tick % 365 : 0;
  const progress = data ? (data.tick / data.totalTicks) * 100 : 0;

  const control = async (action: string, extra?: Record<string, unknown>) => {
    await fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
  };

  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-2 text-xs">
      {/* Left: status */}
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${
          data?.status === "running" ? "bg-[var(--color-green)] animate-pulse" :
          data?.status === "paused" ? "bg-[var(--color-amber)]" :
          data?.status === "completed" ? "bg-[var(--color-red)]" :
          "bg-[var(--color-dim)]"
        }`} />
        <span className="text-[var(--color-dim)]">SIMULATION</span>
      </div>

      {/* Time display */}
      <span className="text-[var(--color-fg)]">Year {year}/100</span>
      <span className="text-[var(--color-dim)]">Day {day}</span>

      {/* Progress bar */}
      <div className="flex-1 h-1 bg-[var(--color-border)] relative">
        <div
          className="absolute left-0 top-0 h-full bg-[var(--color-green)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        {[1, 10, 50, 100].map(s => (
          <button
            key={s}
            onClick={() => control(data?.status === "idle" ? "init" : "resume", { speed: s })}
            className={`px-2 py-0.5 cursor-pointer ${
              data?.speed === s
                ? "text-[var(--color-fg)] bg-[var(--color-hover)]"
                : "text-[var(--color-dim)] hover:text-[var(--color-fg)]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Play/Pause/Reset */}
      <div className="flex items-center gap-2">
        {data?.status === "idle" && (
          <button onClick={() => control("init")} className="text-[var(--color-green)] hover:underline cursor-pointer">init</button>
        )}
        {data?.status === "idle" && (
          <button onClick={async () => { await control("init"); await control("start"); }} className="text-[var(--color-green)] hover:underline cursor-pointer">start</button>
        )}
        {data?.status === "running" && (
          <button onClick={() => control("pause")} className="text-[var(--color-amber)] hover:underline cursor-pointer">pause</button>
        )}
        {data?.status === "paused" && (
          <button onClick={() => control("resume")} className="text-[var(--color-green)] hover:underline cursor-pointer">resume</button>
        )}
        {data?.status !== "idle" && (
          <button onClick={() => control("reset")} className="text-[var(--color-red)] hover:underline cursor-pointer">reset</button>
        )}
      </div>
    </div>
  );
}
