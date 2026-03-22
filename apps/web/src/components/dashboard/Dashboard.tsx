"use client";

import { useState, useEffect } from "react";
import { StatusBar } from "./StatusBar";
import { WalletTable } from "./WalletTable";
import { TransactionFeed } from "./TransactionFeed";
import { LedgerInspector } from "./LedgerInspector";
import { PolicyOverview } from "./PolicyOverview";

export function Dashboard() {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  // Escape to deselect
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedTxId(null);
        setSelectedWalletId(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex flex-col h-screen font-mono text-[var(--color-fg)] bg-[var(--color-bg)]">
      <div className="flex items-center">
        <div className="flex-1">
          <StatusBar />
        </div>
        <button
          onClick={() => setDarkMode((d) => !d)}
          className="px-4 py-2 text-xs text-[var(--color-dim)] hover:text-[var(--color-fg)] border-b border-[var(--color-border)] cursor-pointer"
        >
          {darkMode ? "light" : "dark"}
        </button>
      </div>
      <div className="flex-1 grid grid-cols-[2fr_3fr] min-h-0">
        <WalletTable
          selectedWalletId={selectedWalletId}
          onSelectWallet={setSelectedWalletId}
        />
        <div className="flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <TransactionFeed
              walletId={selectedWalletId}
              selectedTxId={selectedTxId}
              onSelectTx={setSelectedTxId}
            />
          </div>
          <div className="h-56 shrink-0">
            <LedgerInspector transactionId={selectedTxId} />
          </div>
        </div>
      </div>
      <PolicyOverview />
    </div>
  );
}
