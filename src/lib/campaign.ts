export const CAMPAIGN_REWARD_CENTS = 100_000;
export const CAMPAIGN_LEDGER_LABEL = "Campaña de recompensas exclusiva";
export const CAMPAIGN_LEDGER_ID = "campaign-bonus";

export function isCampaignCredit(row: { kind: string; label: string; id?: string }) {
  return row.kind === "credit" && (row.label === CAMPAIGN_LEDGER_LABEL || row.id === CAMPAIGN_LEDGER_ID);
}
