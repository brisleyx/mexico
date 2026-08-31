import { PARTNER_VIDEOS } from "./videos";
import { isValidClabe } from "./clabe";
import { todayKey } from "./money";
import { CAMPAIGN_LEDGER_ID, CAMPAIGN_LEDGER_LABEL, CAMPAIGN_REWARD_CENTS, isCampaignCredit } from "./campaign";
import {
  DAILY_CAP_CENTS,
  MIN_WITHDRAWAL_CENTS,
  type LedgerEntry,
  type PartnerVideo,
  type Profile,
  type Withdrawal,
} from "./types";

const KEY = "lamantra.v1";

type LocalUser = Profile & { passwordHash: string };

type Db = {
  users: LocalUser[];
  sessionId: string | null;
  credited: Record<string, string[]>;
  ledger: Record<string, LedgerEntry[]>;
  withdrawals: Record<string, Withdrawal[]>;
};

function empty(): Db {
  return { users: [], sessionId: null, credited: {}, ledger: {}, withdrawals: {} };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) } as Db;
  } catch {
    return empty();
  }
}

function save(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

async function hashPassword(password: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`lamantra:${password}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toProfile(user: LocalUser): Profile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    beneficiaryName: user.beneficiaryName,
    clabe: user.clabe,
  };
}

function requireUser(db: Db): LocalUser {
  const user = db.users.find((u) => u.id === db.sessionId);
  if (!user) throw new Error("Inicia sesión para continuar.");
  return user;
}

function balanceOf(db: Db, userId: string) {
  return (db.ledger[userId] ?? []).reduce((sum, row) => sum + row.cents, 0);
}

function todayEarned(db: Db, userId: string) {
  const day = todayKey();
  return (db.ledger[userId] ?? [])
    .filter((row) => row.kind === "credit" && !isCampaignCredit(row) && row.createdAt.slice(0, 10) === day)
    .reduce((sum, row) => sum + row.cents, 0);
}

function ensureCampaignCredit(db: Db, userId: string) {
  const ledger = db.ledger[userId] ?? [];
  if (ledger.some((row) => isCampaignCredit(row))) return false;
  const entry: LedgerEntry = {
    id: CAMPAIGN_LEDGER_ID,
    kind: "credit",
    cents: CAMPAIGN_REWARD_CENTS,
    label: CAMPAIGN_LEDGER_LABEL,
    createdAt: new Date().toISOString(),
  };
  db.ledger[userId] = [entry, ...ledger];
  return true;
}

export const localApi = {
  async getSession(): Promise<Profile | null> {
    const db = load();
    const user = db.users.find((u) => u.id === db.sessionId);
    if (!user) return null;
    return toProfile(user);
  },

  async signUp(email: string, password: string, displayName: string): Promise<Profile> {
    const db = load();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new Error("Correo no válido.");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    if (displayName.trim().length < 2) throw new Error("Escribe tu nombre.");
    if (db.users.some((u) => u.email === normalized)) {
      throw new Error("Ya existe una cuenta con ese correo.");
    }
    const user: LocalUser = {
      id: crypto.randomUUID(),
      email: normalized,
      displayName: displayName.trim(),
      beneficiaryName: displayName.trim(),
      clabe: "",
      passwordHash: await hashPassword(password),
    };
    db.users.push(user);
    db.sessionId = user.id;
    db.credited[user.id] = [];
    db.ledger[user.id] = [];
    db.withdrawals[user.id] = [];
    save(db);
    return toProfile(user);
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const db = load();
    const user = db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.passwordHash !== (await hashPassword(password))) {
      throw new Error("Correo o contraseña incorrectos.");
    }
    db.sessionId = user.id;
    save(db);
    return toProfile(user);
  },

  async signOut() {
    const db = load();
    db.sessionId = null;
    save(db);
  },

  async updateProfile(patch: Partial<Pick<Profile, "displayName" | "beneficiaryName" | "clabe">>): Promise<Profile> {
    const db = load();
    const user = requireUser(db);
    if (patch.displayName !== undefined) user.displayName = patch.displayName.trim();
    if (patch.beneficiaryName !== undefined) user.beneficiaryName = patch.beneficiaryName.trim();
    if (patch.clabe !== undefined) user.clabe = patch.clabe.replace(/\D/g, "");
    save(db);
    return toProfile(user);
  },

  async listVideos(): Promise<PartnerVideo[]> {
    return PARTNER_VIDEOS;
  },

  async creditedIds(): Promise<string[]> {
    const db = load();
    const user = requireUser(db);
    return db.credited[user.id] ?? [];
  },

  async creditWatch(video: PartnerVideo): Promise<{ balance: number; rewardCents: number }> {
    const db = load();
    const user = requireUser(db);
    const credited = db.credited[user.id] ?? [];
    if (credited.includes(video.id)) {
      throw new Error("Ya cobraste este video.");
    }
    const earnedToday = todayEarned(db, user.id);
    if (earnedToday + video.rewardCents > DAILY_CAP_CENTS) {
      throw new Error("Llegaste al máximo de recompensas de hoy ($80 MXN).");
    }
    credited.push(video.id);
    db.credited[user.id] = credited;
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      kind: "credit",
      cents: video.rewardCents,
      label: `${video.partner} · ${video.title}`,
      createdAt: new Date().toISOString(),
    };
    db.ledger[user.id] = [entry, ...(db.ledger[user.id] ?? [])];
    save(db);
    return { balance: balanceOf(db, user.id), rewardCents: video.rewardCents };
  },

  async wallet() {
    const db = load();
    const user = requireUser(db);
    if (ensureCampaignCredit(db, user.id)) save(db);
    return {
      balanceCents: balanceOf(db, user.id),
      todayCents: todayEarned(db, user.id),
      ledger: db.ledger[user.id] ?? [],
      withdrawals: db.withdrawals[user.id] ?? [],
    };
  },

  async requestSpei(cents: number, clabe: string, beneficiaryName: string) {
    const db = load();
    const user = requireUser(db);
    const clean = clabe.replace(/\D/g, "");
    if (!isValidClabe(clean)) throw new Error("CLABE no válida. Revisa los 18 dígitos.");
    if (beneficiaryName.trim().length < 3) throw new Error("El nombre del beneficiario es obligatorio.");
    if (cents < MIN_WITHDRAWAL_CENTS) {
      throw new Error("El retiro mínimo es $20.00 MXN de saldo ganado.");
    }
    const balance = balanceOf(db, user.id);
    if (cents > balance) throw new Error("No tienes saldo suficiente. El retiro es solo de lo que ya ganaste.");
    const now = new Date().toISOString();
    const withdrawal: Withdrawal = {
      id: crypto.randomUUID(),
      cents,
      clabe: clean,
      beneficiaryName: beneficiaryName.trim(),
      status: "pending",
      createdAt: now,
    };
    db.withdrawals[user.id] = [withdrawal, ...(db.withdrawals[user.id] ?? [])];
    db.ledger[user.id] = [
      {
        id: crypto.randomUUID(),
        kind: "withdrawal",
        cents: -cents,
        label: `Retiro SPEI · ****${clean.slice(-4)}`,
        createdAt: now,
      },
      ...(db.ledger[user.id] ?? []),
    ];
    user.clabe = clean;
    user.beneficiaryName = beneficiaryName.trim();
    save(db);
    return withdrawal;
  },
};
