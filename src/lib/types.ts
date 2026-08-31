export type PartnerVideo = {
  id: string;
  partner: string;
  title: string;
  description: string;
  durationSec: number;
  rewardCents: number;
  src: string;
  poster: string;
};

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  beneficiaryName: string;
  clabe: string;
};

export type LedgerEntry = {
  id: string;
  kind: "credit" | "withdrawal";
  cents: number;
  label: string;
  createdAt: string;
};

export type Withdrawal = {
  id: string;
  cents: number;
  clabe: string;
  beneficiaryName: string;
  status: "pending" | "sent" | "rejected";
  createdAt: string;
};

export const MIN_WITHDRAWAL_CENTS = 2_000; // $20.00 MXN ganados
export const DAILY_CAP_CENTS = 8_000; // $80.00 MXN por día
export const WATCH_THRESHOLD = 0.8;
