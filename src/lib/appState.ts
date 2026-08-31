export const FLOW = ["presell", "one", "loading", "checkout", "five", "payment-gateway", "success"] as const;

export type StepId = (typeof FLOW)[number];

export type UserData = {
  nome: string;
  email: string;
  clabe: string;
  /** Kept in sync with `clabe` for leftover readers. */
  chave: string;
  metodo: string;
};

export type AppState = {
  currentStep: StepId;
  balance: number;
  lastWithdrawalCents: number;
  userData: UserData;
};

const STORAGE_KEY = "lamantra.funnel.v1";

const emptyUserData = (): UserData => ({
  nome: "",
  email: "",
  clabe: "",
  chave: "",
  metodo: "SPEI",
});

const initialState = (): AppState => ({
  currentStep: "presell",
  balance: 0,
  lastWithdrawalCents: 0,
  userData: emptyUserData(),
});

function isUserData(value: unknown): value is UserData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const hasAccount = typeof data.clabe === "string" || typeof data.chave === "string";
  return (
    typeof data.nome === "string" &&
    typeof data.email === "string" &&
    typeof data.metodo === "string" &&
    hasAccount
  );
}

function accountDigits(data: { clabe?: string; chave?: string }): string {
  const clabe = (data.clabe ?? "").trim().replace(/\s+/g, "");
  const chave = (data.chave ?? "").trim().replace(/\s+/g, "");
  return clabe || chave;
}

function isGuestName(nome: string): boolean {
  return nome.trim() === "Cuenta";
}

function isGuestEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  return (
    value.endsWith("@mail.lamantra.app") ||
    value.endsWith("@lamantra.local") ||
    /^cuenta\./.test(value)
  );
}

function sanitizeUserData(data: UserData): UserData {
  const clabe = accountDigits(data);
  const nome = data.nome.trim().replace(/\s+/g, " ");
  const email = data.email.trim();
  return {
    nome: isGuestName(nome) ? "" : nome,
    email: isGuestEmail(email) ? "" : email,
    clabe,
    chave: clabe,
    metodo: data.metodo.trim() || "SPEI",
  };
}

function applyUserPatch(current: UserData, patch: Partial<UserData>): UserData {
  const next = { ...current, ...patch };
  if (patch.clabe !== undefined && patch.chave === undefined) {
    next.chave = patch.clabe;
  } else if (patch.chave !== undefined && patch.clabe === undefined) {
    next.clabe = patch.chave;
  }
  return sanitizeUserData(next);
}

function readPersisted(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      currentStep: parsed.currentStep && FLOW.includes(parsed.currentStep) ? parsed.currentStep : undefined,
      lastWithdrawalCents: typeof parsed.lastWithdrawalCents === "number" ? parsed.lastWithdrawalCents : undefined,
      userData: isUserData(parsed.userData) ? sanitizeUserData(parsed.userData) : undefined,
    };
  } catch {
    return {};
  }
}

function persist(next: AppState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentStep: next.currentStep,
        lastWithdrawalCents: next.lastWithdrawalCents,
        userData: next.userData,
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

function clearPersisted() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type Listener = (state: AppState) => void;

const hydrated = readPersisted();
let state: AppState = {
  ...initialState(),
  ...hydrated,
  userData: hydrated.userData ?? emptyUserData(),
};
const listeners = new Set<Listener>();

function emit() {
  persist(state);
  for (const listener of listeners) listener(state);
}

export function isStepId(id: string): id is StepId {
  return (FLOW as readonly string[]).includes(id);
}

export const appState = {
  get(): AppState {
    return state;
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  set(patch: Partial<Omit<AppState, "userData">> & { userData?: Partial<UserData> }) {
    state = {
      ...state,
      ...patch,
      userData: patch.userData ? applyUserPatch(state.userData, patch.userData) : state.userData,
    };
    emit();
  },

  setStep(currentStep: StepId) {
    if (state.currentStep === currentStep) {
      persist(state);
      return;
    }
    state = { ...state, currentStep };
    emit();
  },

  setBalance(balance: number) {
    if (state.balance === balance) return;
    state = { ...state, balance };
    emit();
  },

  setLastWithdrawal(lastWithdrawalCents: number) {
    state = { ...state, lastWithdrawalCents };
    emit();
  },

  patchUserData(patch: Partial<UserData>) {
    state = { ...state, userData: applyUserPatch(state.userData, patch) };
    emit();
  },

  reset() {
    state = initialState();
    clearPersisted();
    for (const listener of listeners) listener(state);
  },
};
