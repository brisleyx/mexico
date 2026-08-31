import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TUTORIAL_SRC = "/tutorial-retirar.mp4";

export function SetupVideoModal({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatched = useRef(0);
  const [showContinue, setShowContinue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheetIn, setSheetIn] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowContinue(false);
      setBusy(false);
      setPlaying(false);
      setFailed(false);
      setProgress(0);
      setSheetIn(false);
      maxWatched.current = 0;
      return;
    }
    setShowContinue(false);
    setSheetIn(false);
    maxWatched.current = 0;
    const enter = window.setTimeout(() => setSheetIn(true), 40);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(enter);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const host = document.getElementById("root");
  if (!host) return null;

  function goContinue() {
    if (busy || !showContinue) return;
    setBusy(true);
    videoRef.current?.pause();
    onContinue();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video || failed) return;
    if (video.paused) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }

  return createPortal(
    <div className={`setup-step setup-video-overlay${sheetIn ? " is-open" : ""}`} id="five-step0" role="dialog" aria-modal="true" aria-label="Video de instrucciones">
      <div
        className={`setup-video-card${sheetIn ? " is-in" : ""}`}
        style={{ transform: sheetIn ? "translateY(0)" : "translateY(calc(100% + 40px))" }}
      >
        <div className={`setup-player${playing ? " is-playing" : ""}${failed ? " is-failed" : ""}`}>
          <video
            ref={videoRef}
            className="setup-player-video"
            src={TUTORIAL_SRC}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setProgress(1);
              setShowContinue(true);
            }}
            onTimeUpdate={(event) => {
              const node = event.currentTarget;
              if (!node.duration) return;
              if (node.currentTime > maxWatched.current + 1.25) {
                node.currentTime = maxWatched.current;
                return;
              }
              if (node.currentTime > maxWatched.current) maxWatched.current = node.currentTime;
              setProgress(maxWatched.current / node.duration);
            }}
            onError={() => {
              setFailed(true);
              setPlaying(false);
              setShowContinue(true);
            }}
          />
          <button
            type="button"
            className="setup-player-hit"
            aria-label={playing ? "Pausar video" : "Reproducir video"}
            onClick={togglePlay}
          />
          <span className="setup-player-play" aria-hidden="true" />
          <span
            className="setup-player-progress"
            aria-hidden="true"
            style={{ ["--setup-progress" as string]: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className={`setup-video-actions${showContinue ? " is-ready" : ""}`}>
          <button
            type="button"
            id="btn-five-step0"
            className="btn btn-block"
            disabled={busy || !showContinue}
            aria-busy={busy}
            onClick={goContinue}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}
