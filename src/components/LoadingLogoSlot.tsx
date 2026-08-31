import { useState } from "react";

export const LOADING_LOGO_SRC = "/logoteko.png";

export function LoadingLogoSlot() {
  const [ready, setReady] = useState(false);

  return (
    <header className="loading-header">
      <div className={`loading-logo-slot${ready ? " is-ready" : ""}`}>
        <img
          src={LOADING_LOGO_SRC}
          alt=""
          className="loading-logo-img"
          onLoad={() => setReady(true)}
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
        />
      </div>
    </header>
  );
}
