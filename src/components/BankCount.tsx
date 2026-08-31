import { useEffect, useState } from "react";

const mxnNumber = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmount(cents: number, targetCents = cents): string {
  const intDigits = String(Math.floor(Math.abs(targetCents) / 100)).length;
  const intPart = Math.floor(Math.abs(cents) / 100);
  const frac = Math.abs(cents) % 100;
  const grouped = String(intPart)
    .padStart(Math.max(1, intDigits), "0")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${String(frac).padStart(2, "0")}`;
}

export function BankCount({
  cents,
  prefix = "MXN",
  duration = 2200,
}: {
  cents: number;
  prefix?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduceMotion || cents <= 0) {
      setShown(cents);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(cents * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents, duration, reduceMotion]);

  const label = `${prefix} ${mxnNumber.format(cents / 100)}`;
  const chars = formatAmount(shown, cents).split("");

  return (
    <span className="bank-count" aria-label={label}>
      <span className="bank-prefix">{prefix}</span>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="bank-digit" key={`d-${i}`}>
            <span className="bank-reel" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="bank-sep" key={`s-${i}-${ch}`}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
