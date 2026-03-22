"use client";

import { useEffect, useState } from "react";
import { formatUsdc, truncateId } from "@/lib/format";

interface LedgerEntry {
  id: string;
  walletId: string;
  walletName: string;
  amount: string;
  direction: string;
  createdAt: string;
}

interface LedgerData {
  transaction: {
    id: string;
    idempotencyKey: string;
    amount: string;
    memo: string | null;
    status: string;
    txHash: string | null;
    createdAt: string;
  };
  entries: LedgerEntry[];
}

interface Props {
  transactionId: string | null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[var(--color-dim)] w-20 shrink-0">{label}</span>
      <span className="text-[var(--color-fg)] truncate">{value}</span>
    </div>
  );
}

export function LedgerInspector({ transactionId }: Props) {
  const [data, setData] = useState<LedgerData | null>(null);

  useEffect(() => {
    if (!transactionId) {
      setData(null);
      return;
    }

    fetch(`/api/dashboard/ledger/${transactionId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [transactionId]);

  return (
    <div className="flex flex-col overflow-hidden border-t border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-dim)]">
        LEDGER
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 text-xs">
        {!transactionId ? (
          <div className="py-4 text-center text-[var(--color-dim)]">
            click a transaction to inspect
          </div>
        ) : !data ? (
          <div className="py-4 text-center text-[var(--color-dim)]">
            loading...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Field label="tx" value={truncateId(data.transaction.id)} />
              <Field label="amount" value={`${formatUsdc(data.transaction.amount)} USDC`} />
              <Field label="status" value={data.transaction.status} />
              <Field label="idem_key" value={data.transaction.idempotencyKey} />
              {data.transaction.memo && (
                <Field label="memo" value={data.transaction.memo} />
              )}
              {data.transaction.txHash && (
                <div className="flex items-baseline gap-2">
                  <span className="text-[var(--color-dim)] w-20 shrink-0">
                    on-chain
                  </span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${data.transaction.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-green)] hover:underline"
                  >
                    {truncateId(data.transaction.txHash)}
                  </a>
                </div>
              )}
            </div>
            <div className="border-t border-[var(--color-border)] pt-2">
              <div className="text-[var(--color-dim)] mb-1">entries</div>
              {data.entries.map((e) => (
                <div key={e.id} className="flex items-baseline gap-2 py-0.5">
                  <span
                    className={
                      e.direction === "credit"
                        ? "text-[var(--color-green)]"
                        : "text-[var(--color-red)]"
                    }
                  >
                    {e.direction === "credit" ? "+" : "-"}
                    {formatUsdc(e.amount)}
                  </span>
                  <span className="text-[var(--color-fg)]">{e.walletName}</span>
                  <span className="text-[var(--color-dim)]">
                    ({e.direction})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
