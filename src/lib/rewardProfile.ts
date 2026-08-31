import { validateClabe } from "./clabe";

export type RewardProfileInput = {
  nome: string;
  email: string;
  chave: string;
};

export type RewardProfileField = keyof RewardProfileInput;
export type FieldErrors = Partial<Record<RewardProfileField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeRewardProfile(input: RewardProfileInput): RewardProfileInput {
  return {
    nome: input.nome.trim().replace(/\s+/g, " "),
    email: input.email.trim().toLowerCase(),
    chave: input.chave.trim().replace(/\s+/g, ""),
  };
}

export function validateNome(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "Escribe tu nombre de exhibición.";
  if (value.length < 2) return "Usa al menos 2 caracteres.";
  if (value.length > 80) return "El nombre es demasiado largo.";
  if (!/[\p{L}]/u.test(value)) return "El nombre debe incluir letras.";
  return null;
}

export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Escribe tu correo de contacto.";
  if (value.length > 254) return "El correo es demasiado largo.";
  if (/\s/.test(value)) return "El correo no puede tener espacios.";
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return "Usa un correo con formato válido.";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain) return "Usa un correo con formato válido.";
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return "Usa un correo con formato válido.";
  }
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "Usa un correo con formato válido.";
  }
  if (!EMAIL_PATTERN.test(value)) return "Usa un correo con formato válido.";
  return null;
}

export function validateChave(raw: string): string | null {
  return validateClabe(raw);
}

export function validateRewardProfile(
  input: RewardProfileInput,
): { ok: true; value: RewardProfileInput } | { ok: false; errors: FieldErrors } {
  const value = normalizeRewardProfile(input);
  const errors: FieldErrors = {};
  const nomeError = validateNome(value.nome);
  const emailError = validateEmail(value.email);
  const chaveError = validateChave(input.chave);
  if (nomeError) errors.nome = nomeError;
  if (emailError) errors.email = emailError;
  if (chaveError) errors.chave = chaveError;
  if (nomeError || emailError || chaveError) return { ok: false, errors };
  return { ok: true, value };
}
