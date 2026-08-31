import { shiftDayKey, todayKey } from "./money";
import type { LedgerEntry } from "./types";

export type StreakDay = {
  key: string;
  label: string;
  cents: number;
  points: number;
  done: boolean;
};

export function buildStreak(ledger: LedgerEntry[], length = 7): StreakDay[] {
  const today = todayKey();
  const byDay: Record<string, number> = {};
  for (const row of ledger) {
    if (row.kind !== "credit") continue;
    const key = todayKey(new Date(row.createdAt));
    byDay[key] = (byDay[key] ?? 0) + row.cents;
  }
  return Array.from({ length }, (_, i) => {
    const key = shiftDayKey(today, i - (length - 1));
    const cents = byDay[key] ?? 0;
    return {
      key,
      label: `Día ${String(i + 1).padStart(2, "0")}`,
      cents,
      points: (i + 1) * 50,
      done: cents > 0,
    };
  });
}

export function simulateCompletedStreak(length = 7): StreakDay[] {
  const today = todayKey();
  return Array.from({ length }, (_, i) => {
    const key = shiftDayKey(today, i - (length - 1));
    return {
      key,
      label: `Día ${String(i + 1).padStart(2, "0")}`,
      cents: (i + 1) * 50,
      points: (i + 1) * 50,
      done: true,
    };
  });
}
