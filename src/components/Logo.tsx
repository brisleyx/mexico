export function Logo({ word = true }: { word?: boolean }) {
  return (
    <span className="logo">
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#fe2b54" />
        <path d="M12 8h3.2v13.2H22v2.8H12V8Z" fill="#fff" />
      </svg>
      {word ? <span className="logo-word">LaMantra</span> : null}
    </span>
  );
}

export function Coin() {
  return (
    <span className="coin" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="13" height="13">
        <circle cx="8" cy="8" r="7.2" fill="#fedc60" stroke="#faa21c" strokeWidth="1.2" />
        <text x="8" y="11.2" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b45309">
          $
        </text>
      </svg>
    </span>
  );
}
