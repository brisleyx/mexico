export function SyncLoader({ open }: { open: boolean }) {
  return (
    <div
      id="sync-loader"
      className="sync-loader"
      style={{ display: open ? "flex" : "none" }}
      role="status"
      aria-live="polite"
      aria-hidden={open ? undefined : true}
    >
      <div className="sync-spinner" aria-hidden="true" />
      <p className="sync-loader-text">Sincronizando con tu cuenta...</p>
    </div>
  );
}
