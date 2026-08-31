/** Brazilian CPF checksum — Pagnovo's purchase pipeline still validates this on MXN. */

function cpfDigit(nums: number[], factorStart: number): number {
  let sum = 0;
  for (let i = 0; i < nums.length; i++) sum += nums[i] * (factorStart - i);
  const rem = (sum * 10) % 11;
  return rem === 10 ? 0 : rem;
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const n = digits.split("").map(Number);
  const d1 = cpfDigit(n.slice(0, 9), 10);
  const d2 = cpfDigit([...n.slice(0, 9), d1], 11);
  return n[9] === d1 && n[10] === d2;
}

/** Stable 11-digit CPF from a seed (email). Not a real tax id — satisfies the BRL validator. */
export function cpfFromSeed(seed: string): string {
  const s = seed.trim().toLowerCase() || "payer";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let nine = String(Math.abs(h) % 1_000_000_000).padStart(9, "0");
  if (/^(\d)\1{8}$/.test(nine)) nine = "012345678";
  const n = nine.split("").map(Number);
  const d1 = cpfDigit(n, 10);
  const d2 = cpfDigit([...n, d1], 11);
  return `${nine}${d1}${d2}`;
}

export function pagnovoPayerCpf(email: string): string {
  const fromEnv = (Deno.env.get("PAGNOVO_PAYER_CPF") ?? "").replace(/\D/g, "");
  if (isValidCpf(fromEnv)) return fromEnv;
  return cpfFromSeed(email);
}

function seedHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

/** 10-digit MX-style number. Pagnovo requires 8–12 digits; the user never types this. */
export function phoneFromSeed(seed: string): string {
  const rest = String(Math.abs(seedHash(`${seed}:phone`)) % 100_000_000).padStart(8, "0");
  const tail = /^(\d)\1{7}$/.test(rest) ? "98745541" : rest;
  return `55${tail}`;
}

export function pagnovoPayerPhone(email: string): string {
  const fromEnv = (Deno.env.get("PAGNOVO_PAYER_PHONE") ?? "").replace(/\D/g, "");
  if (fromEnv.length >= 8 && fromEnv.length <= 12) return fromEnv;
  return phoneFromSeed(email);
}
