const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function formatMxn(cents: number): string {
  return mxn.format(cents / 100);
}

const mxDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayKey(d = new Date()): string {
  return mxDate.format(d);
}

export function shiftDayKey(key: string, delta: number): string {
  const [y, m, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day + delta));
  return utc.toISOString().slice(0, 10);
}

export function secondsUntilMidnightMX(): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour);
  const m = Number(parts.minute);
  const s = Number(parts.second);
  return 24 * 3600 - (h * 3600 + m * 60 + s);
}

export function formatHms(total: number): string {
  const t = Math.max(0, total);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")} - ${String(m).padStart(2, "0")} - ${String(s).padStart(2, "0")}`;
}
