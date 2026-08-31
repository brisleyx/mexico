export const CAMPAIGN_LEDGER_LABEL = "Campaña de recompensas exclusiva";
export const CAMPAIGN_LEDGER_ID = "campaign-bonus";

const PRIZE_MIN_CENTS = 210_498; // $2,104.98
const PRIZE_MAX_CENTS = 290_459; // $2,904.59
const PRIZE_KEY = "lamantra.campaign-cents.v2";

function isUsablePrize(cents: number) {
  return (
    Number.isInteger(cents) &&
    cents >= PRIZE_MIN_CENTS &&
    cents <= PRIZE_MAX_CENTS &&
    cents % 100 !== 0
  );
}

function randomPrizeCents() {
  const span = PRIZE_MAX_CENTS - PRIZE_MIN_CENTS + 1;
  let cents = PRIZE_MIN_CENTS + Math.floor(Math.random() * span);
  if (cents % 100 === 0) {
    cents = cents >= PRIZE_MAX_CENTS ? cents - 1 : cents + 1;
  }
  return cents;
}

export function getCampaignRewardCents(): number {
  try {
    const stored = Number(sessionStorage.getItem(PRIZE_KEY));
    if (isUsablePrize(stored)) return stored;
  } catch {
    /* private mode */
  }
  const cents = randomPrizeCents();
  try {
    sessionStorage.setItem(PRIZE_KEY, String(cents));
  } catch {
    /* ignore */
  }
  return cents;
}

export function resolveDisplayCents(balance = 0): number {
  if (isUsablePrize(balance)) return balance;
  return getCampaignRewardCents();
}

export function isCampaignCredit(row: { kind: string; label: string; id?: string }) {
  return row.kind === "credit" && (row.label === CAMPAIGN_LEDGER_LABEL || row.id === CAMPAIGN_LEDGER_ID);
}
