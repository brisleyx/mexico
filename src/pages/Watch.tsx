import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatMxn } from "../lib/money";
import { WATCH_THRESHOLD, type PartnerVideo } from "../lib/types";

export function Watch() {
  const { id } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatched = useRef(0);
  const [video, setVideo] = useState<PartnerVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [credited, setCredited] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    maxWatched.current = 0;
    setProgress(0);
    setMessage("");
    setError("");
    setLoading(true);
    Promise.all([api.listVideos(), api.creditedIds()])
      .then(([list, ids]) => {
        if (cancelled) return;
        const found = list.find((item) => item.id === id) ?? null;
        setVideo(found);
        setCredited(found ? ids.includes(found.id) : false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    if (el.currentTime > maxWatched.current + 1.25) {
      el.currentTime = maxWatched.current;
      return;
    }
    if (el.currentTime > maxWatched.current) maxWatched.current = el.currentTime;
    setProgress(Math.min(1, maxWatched.current / el.duration));
  }

  async function claim() {
    if (!video) return;
    setError("");
    try {
      const result = await api.creditWatch(video);
      setCredited(true);
      setMessage(`Acreditamos ${formatMxn(result.rewardCents)}. Saldo: ${formatMxn(result.balance)}.`);
      window.dispatchEvent(new Event("lamantra:wallet"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acreditar.");
    }
  }

  if (loading) return <p className="note">Cargando video…</p>;
  if (!video) {
    return (
      <p className="muted">
        Video no encontrado. <Link to="/app">Volver</Link>
      </p>
    );
  }

  const ready = progress >= WATCH_THRESHOLD && !credited;

  return (
    <section>
      <Link className="back" to="/app">
        ‹ Volver
      </Link>
      <div className="bloco" style={{ marginTop: 8 }}>
        <p className="saldo-label" style={{ margin: 0 }}>
          {video.partner}
        </p>
        <h2 className="page-h" style={{ marginTop: 6 }}>
          {video.title}
        </h2>
        <p className="muted">{video.description}</p>
        <video
          ref={videoRef}
          className="player"
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          onTimeUpdate={onTimeUpdate}
          style={{ marginTop: 12 }}
        />
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="muted">
          Recompensa: <span className="entre-pts" style={{ display: "inline" }}>{formatMxn(video.rewardCents)}</span>
          {" · "}
          Debes ver el {Math.round(WATCH_THRESHOLD * 100)}% sin saltar adelante.
        </p>
        {credited ? (
          <p className="banner" style={{ marginTop: 14 }}>
            Esta campaña ya está acreditada en tu saldo.
          </p>
        ) : (
          <button className="btn btn-block" disabled={!ready} onClick={claim} style={{ marginTop: 16 }}>
            {ready ? `Acreditar ${formatMxn(video.rewardCents)}` : "Sigue viendo para acreditar"}
          </button>
        )}
        {message ? <p className="ok">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
