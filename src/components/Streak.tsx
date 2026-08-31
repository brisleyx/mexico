import type { StreakDay } from "../lib/streak";

export function Streak({ days }: { days: StreakDay[] }) {
  return (
    <div className="streak">
      {days.map((day) => (
        <div className={`streak-item${day.done ? " is-done" : ""}`} key={day.key}>
          <div className="streak-box">
            <div className="streak-coin" aria-hidden="true">
              <span>P</span>
            </div>
            <div className="streak-value">{day.done ? day.points : "—"}</div>
            {day.done ? (
              <div className="streak-check" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.2 6.2 11.5 13 4.5" stroke="#fe2b54" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : null}
          </div>
          <div className="streak-label">{day.label}</div>
        </div>
      ))}
    </div>
  );
}
