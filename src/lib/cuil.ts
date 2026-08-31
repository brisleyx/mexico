/** CUIL/CUIT argentino: 11 dígitos + verificador (módulo 11). */

const PREFIXES = new Set([20, 23, 24, 27, 30, 33, 34]);

export function cuilDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

export function formatCuil(raw: string): string {
  const d = cuilDigits(raw);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function isValidCuil(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const prefix = Number(d.slice(0, 2));
  if (!PREFIXES.has(prefix)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * weights[i];
  let rem = 11 - (sum % 11);
  if (rem === 11) rem = 0;
  if (rem === 10) return false;
  return rem === Number(d[10]);
}

export function validateCuil(raw: string): string | null {
  if (!raw.trim()) return "Escribe tu CUIL.";
  if (!isValidCuil(raw)) return "CUIL inválido — verifique los dígitos";
  return null;
}
