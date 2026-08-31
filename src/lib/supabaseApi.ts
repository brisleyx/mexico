import { isValidClabe } from "./clabe";
import { todayKey } from "./money";
import { CAMPAIGN_LEDGER_LABEL, getCampaignRewardCents, isCampaignCredit } from "./campaign";
import { supabase } from "./supabase";
import {
  DAILY_CAP_CENTS,
  MIN_WITHDRAWAL_CENTS,
  type LedgerEntry,
  type PartnerVideo,
  type Profile,
  type Withdrawal,
} from "./types";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

async function uid() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("Inicia sesión para continuar.");
  return data.user;
}

function mapProfile(user: { id: string; email?: string | null }, row: {
  display_name: string;
  beneficiary_name: string;
  clabe: string;
}): Profile {
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: row.display_name,
    beneficiaryName: row.beneficiary_name,
    clabe: row.clabe,
  };
}

export const supabaseApi = {
  async getSession(): Promise<Profile | null> {
    const { data } = await client().auth.getUser();
    if (!data.user) return null;
    const { data: row, error } = await client()
      .from("profiles")
      .select("display_name, beneficiary_name, clabe")
      .eq("id", data.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return {
        id: data.user.id,
        email: data.user.email ?? "",
        displayName: data.user.user_metadata?.display_name ?? "",
        beneficiaryName: "",
        clabe: "",
      };
    }
    return mapProfile(data.user, row);
  },

  async ensureSession(): Promise<Profile> {
    try {
      const existing = await this.getSession();
      if (existing) return existing;
    } catch {
      /* continue into guest sync */
    }

    const { data: anon, error: anonError } = await client().auth.signInAnonymously({
      options: { data: { display_name: "Cuenta" } },
    });
    if (!anonError && anon.user) {
      try {
        const session = await this.getSession();
        if (session) return session;
      } catch {
        /* try stored guest next */
      }
    }

    const guestKey = "lamantra.sync-account";
    try {
      const saved = localStorage.getItem(guestKey);
      if (saved) {
        const { email, password } = JSON.parse(saved) as { email: string; password: string };
        return await this.signIn(email, password);
      }
    } catch {
      localStorage.removeItem(guestKey);
    }

    const email = `cuenta.${crypto.randomUUID()}@mail.lamantra.app`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: { data: { display_name: "Cuenta" } },
    });
    if (error) throw new Error(error.message);
    if (!data.session && data.user) {
      const { error: signInError } = await client().auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
    }
    localStorage.setItem(guestKey, JSON.stringify({ email, password }));
    const session = await this.getSession();
    if (!session) throw new Error("No se pudo sincronizar la cuenta.");
    return session;
  },

  async signUp(email: string, password: string, displayName: string): Promise<Profile> {
    const { data, error } = await client().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Revisa tu correo para confirmar la cuenta.");
    return {
      id: data.user.id,
      email: data.user.email ?? email,
      displayName: displayName.trim(),
      beneficiaryName: displayName.trim(),
      clabe: "",
    };
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const { error } = await client().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    const session = await this.getSession();
    if (!session) throw new Error("No se pudo leer el perfil.");
    return session;
  },

  async signOut() {
    const { error } = await client().auth.signOut();
    if (error) throw new Error(error.message);
  },

  async updateProfile(patch: Partial<Pick<Profile, "displayName" | "beneficiaryName" | "clabe">>): Promise<Profile> {
    const user = await uid();
    const payload: Record<string, string> = {};
    if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim();
    if (patch.beneficiaryName !== undefined) payload.beneficiary_name = patch.beneficiaryName.trim();
    if (patch.clabe !== undefined) payload.clabe = patch.clabe.replace(/\D/g, "");
    payload.updated_at = new Date().toISOString();
    const { error } = await client().from("profiles").upsert({ id: user.id, ...payload });
    if (error) throw new Error(error.message);
    const session = await this.getSession();
    if (!session) throw new Error("No se pudo actualizar el perfil.");
    return session;
  },

  async listVideos(): Promise<PartnerVideo[]> {
    const { data, error } = await client()
      .from("partner_videos")
      .select("id, partner, title, description, duration_sec, reward_cents, src, poster")
      .order("reward_cents", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      partner: row.partner,
      title: row.title,
      description: row.description,
      durationSec: row.duration_sec,
      rewardCents: row.reward_cents,
      src: row.src,
      poster: row.poster ?? "",
    }));
  },

  async creditedIds(): Promise<string[]> {
    const user = await uid();
    const { data, error } = await client().from("watch_credits").select("video_id").eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.video_id);
  },

  async creditWatch(video: PartnerVideo) {
    const user = await uid();
    const start = `${todayKey()}T00:00:00.000Z`;
    const { data: todayRows, error: todayError } = await client()
      .from("ledger")
      .select("cents, label")
      .eq("user_id", user.id)
      .eq("kind", "credit")
      .gte("created_at", start);
    if (todayError) throw new Error(todayError.message);
    const earnedToday = (todayRows ?? [])
      .filter((row) => !isCampaignCredit({ kind: "credit", label: row.label }))
      .reduce((sum, row) => sum + row.cents, 0);
    if (earnedToday + video.rewardCents > DAILY_CAP_CENTS) {
      throw new Error("Llegaste al máximo de recompensas de hoy ($80 MXN).");
    }
    const { error: creditError } = await client().from("watch_credits").insert({
      user_id: user.id,
      video_id: video.id,
      reward_cents: video.rewardCents,
    });
    if (creditError) {
      if (creditError.code === "23505") throw new Error("Ya cobraste este video.");
      throw new Error(creditError.message);
    }
    const { error: ledgerError } = await client().from("ledger").insert({
      user_id: user.id,
      kind: "credit",
      cents: video.rewardCents,
      label: `${video.partner} · ${video.title}`,
    });
    if (ledgerError) throw new Error(ledgerError.message);
    const wallet = await this.wallet();
    return { balance: wallet.balanceCents, rewardCents: video.rewardCents };
  },

  async wallet() {
    return this.loadWallet(true);
  },

  async loadWallet(grantCampaign: boolean) {
    const user = await uid();
    const { data: ledgerRows, error: ledgerError } = await client()
      .from("ledger")
      .select("id, kind, cents, label, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (ledgerError) throw new Error(ledgerError.message);
    const ledger: LedgerEntry[] = (ledgerRows ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      cents: row.cents,
      label: row.label,
      createdAt: row.created_at,
    }));
    const prizeCents = getCampaignRewardCents();
    const campaignRow = ledger.find((row) => isCampaignCredit(row));
    if (grantCampaign && !campaignRow) {
      const { error: campaignError } = await client().from("ledger").insert({
        user_id: user.id,
        kind: "credit",
        cents: prizeCents,
        label: CAMPAIGN_LEDGER_LABEL,
      });
      if (campaignError && campaignError.code !== "23505") throw new Error(campaignError.message);
      ledger.unshift({
        id: CAMPAIGN_LEDGER_LABEL,
        kind: "credit",
        cents: prizeCents,
        label: CAMPAIGN_LEDGER_LABEL,
        createdAt: new Date().toISOString(),
      });
    } else if (grantCampaign && campaignRow && campaignRow.cents !== prizeCents) {
      const { error: updateError } = await client()
        .from("ledger")
        .update({ cents: prizeCents })
        .eq("id", campaignRow.id);
      if (updateError) throw new Error(updateError.message);
      campaignRow.cents = prizeCents;
    }
    const { data: wdRows, error: wdError } = await client()
      .from("withdrawals")
      .select("id, cents, clabe, beneficiary_name, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (wdError) throw new Error(wdError.message);
    const withdrawals: Withdrawal[] = (wdRows ?? []).map((row) => ({
      id: row.id,
      cents: row.cents,
      clabe: row.clabe,
      beneficiaryName: row.beneficiary_name,
      status: row.status,
      createdAt: row.created_at,
    }));
    const day = todayKey();
    return {
      balanceCents: ledger.reduce((sum, row) => sum + row.cents, 0),
      todayCents: ledger
        .filter((row) => row.kind === "credit" && !isCampaignCredit(row) && row.createdAt.slice(0, 10) === day)
        .reduce((sum, row) => sum + row.cents, 0),
      ledger,
      withdrawals,
    };
  },

  async requestSpei(cents: number, clabe: string, beneficiaryName: string) {
    const user = await uid();
    const clean = clabe.replace(/\D/g, "");
    if (!isValidClabe(clean)) throw new Error("CLABE no válida. Revisa los 18 dígitos.");
    if (beneficiaryName.trim().length < 3) throw new Error("El nombre del beneficiario es obligatorio.");
    if (cents < MIN_WITHDRAWAL_CENTS) {
      throw new Error("El retiro mínimo es $20.00 MXN de saldo ganado.");
    }
    const wallet = await this.wallet();
    if (cents > wallet.balanceCents) {
      throw new Error("No tienes saldo suficiente. El retiro es solo de lo que ya ganaste.");
    }
    const { data, error } = await client()
      .from("withdrawals")
      .insert({
        user_id: user.id,
        cents,
        clabe: clean,
        beneficiary_name: beneficiaryName.trim(),
        status: "pending",
      })
      .select("id, cents, clabe, beneficiary_name, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    const { error: ledgerError } = await client().from("ledger").insert({
      user_id: user.id,
      kind: "withdrawal",
      cents: -cents,
      label: `Retiro SPEI · ****${clean.slice(-4)}`,
    });
    if (ledgerError) throw new Error(ledgerError.message);
    await client()
      .from("profiles")
      .update({ clabe: clean, beneficiary_name: beneficiaryName.trim() })
      .eq("id", user.id);
    return {
      id: data.id,
      cents: data.cents,
      clabe: data.clabe,
      beneficiaryName: data.beneficiary_name,
      status: data.status,
      createdAt: data.created_at,
    } satisfies Withdrawal;
  },
};
