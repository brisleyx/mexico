import { useEffect, useState } from "react";
import { formatHms, secondsUntilMidnightMX } from "../lib/money";

export function ResetTimer({ prefix = "El tope diario se reinicia en" }: { prefix?: string }) {
  const [left, setLeft] = useState(secondsUntilMidnightMX);

  useEffect(() => {
    const id = setInterval(() => setLeft(secondsUntilMidnightMX()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="timer-strip">
      {prefix} <b>{formatHms(left)}</b>
    </div>
  );
}
