/** CLABE mexicana: 18 dígitos + dígito verificador (pesos 3, 7, 1). */

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isClabeLength(raw: string): boolean {
  return /^\d{18}$/.test(digitsOnly(raw));
}

export function isValidClabe(raw: string): boolean {
  const clabe = digitsOnly(raw);
  if (!isClabeLength(clabe)) return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (Number(clabe[i]) * weights[i]) % 10;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(clabe[17]);
}

export function formatClabe(raw: string): string {
  const d = digitsOnly(raw).slice(0, 18);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10), d.slice(10, 14), d.slice(14, 18)]
    .filter(Boolean)
    .join(" ");
}

export function validateClabe(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (!raw.trim() || !digits) return "Escribe tu CLABE de 18 dígitos.";
  if (digits.length !== 18) return "La CLABE debe tener 18 dígitos.";
  if (/^0+$/.test(digits)) return "Esa CLABE no es válida.";
  if (!isValidClabe(digits)) return "CLABE inválida — verifica los dígitos.";
  return null;
}
