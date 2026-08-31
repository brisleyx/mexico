import { useEffect, useState } from "react";
import { formatMxn } from "../lib/money";

export function CountUp({ cents, className }: { cents: number; className?: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const from = 0;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(from + (cents - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cents]);

  return <span className={className}>{formatMxn(shown)}</span>;
}
