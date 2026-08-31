import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TUTORIAL_SRC = "/tutorial-retirar.mp4";
const JUMP_50_MS = 380;
const JUMP_80_MS = 2_000;

function mappedProgress(elapsedMs: number, currentTime: number, duration: number, ended: boolean) {
  if (ended) return 1;
  if (elapsedMs <= JUMP_50_MS) return Math.min(0.5, (elapsedMs / JUMP_50_MS) * 0.5);
  if (elapsedMs < JUMP_80_MS) return 0.5;
  if (!(duration > 0)) return 0.8;
  const tailStart = Math.min(2, duration);
  const tail = Math.max(0.001, duration - tailStart);
  const playedInTail = Math.max(0, currentTime - tailStart);
  return 0.8 + 0.2 * Math.min(1, playedInTail / tail);
}

export type SetupVideoModalHandle = {
  playNow: () => void;
};

export const SetupVideoModal = forwardRef<
  SetupVideoModalHandle,
  {
    open: boolean;
    onContinue: () => void;
  }
>(function SetupVideoModal({ open, onContinue }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedAt = useRef(0);
  const maxWatched = useRef(0);
  const [showContinue, setShowContinue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sheetIn, setSheetIn] = useState(false);

  function playNow() {
    const video = videoRef.current;
    if (!video || failed) return;
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    video.muted = true;
    const run = video.play();
    if (run && typeof run.then === "function") {
      void run
        .then(() => {
          video.muted = false;
        })
        .catch(() => {
          video.muted = true;
          void video.play().catch(() => setPlaying(false));
        });
    }
  }

  useImperativeHandle(ref, () => ({ playNow }), [failed]);

  useEffect(() => {
    if (!open) {
      setShowContinue(false);
      setBusy(false);
      setPlaying(false);
      setProgress(0);
      setSheetIn(false);
      maxWatched.current = 0;
      startedAt.current = 0;
      videoRef.current?.pause();
      return;
    }
    setShowContinue(false);
    setBusy(false);
    setProgress(0);
    maxWatched.current = 0;
    startedAt.current = performance.now();
    const enter = window.setTimeout(() => setSheetIn(true), 40);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(enter);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const video = videoRef.current;
      const elapsed = performance.now() - startedAt.current;
      const duration = video?.duration && Number.isFinite(video.duration) ? video.duration : 0;
      const current = video?.currentTime ?? 0;
      const ended = Boolean(video?.ended);
      setProgress(mappedProgress(elapsed, current, duration, ended || showContinue));
    };
    tick();
    const id = window.setInterval(tick, 80);
    return () => window.clearInterval(id);
  }, [open, showContinue]);

  const host = document.getElementById("root");
  if (!host) return null;

  const fillPct = `${Math.round((failed || showContinue ? 1 : progress) * 100)}%`;

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
      video.muted = false;
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => setPlaying(false));
      });
    } else {
      video.pause();
    }
  }

  return createPortal(
    <div
      className={`setup-step setup-video-overlay${open ? " is-visible" : ""}${open && sheetIn ? " is-open" : ""}`}
      id="five-step0"
      role="dialog"
      aria-modal={open}
      aria-hidden={open ? undefined : true}
      aria-label="Video de instrucciones"
    >
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
            muted
            preload="auto"
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
            }}
            onError={() => {
              setFailed(true);
              setPlaying(false);
              setShowContinue(true);
              setProgress(1);
            }}
          />
          <button
            type="button"
            className="setup-player-hit"
            aria-label={playing ? "Pausar video" : "Reproducir video"}
            onClick={togglePlay}
          />
          <span className="setup-player-play" aria-hidden="true" />
          <span className="setup-player-progress" aria-hidden="true" style={{ ["--setup-progress" as string]: fillPct }} />
        </div>
        <div className={`setup-video-actions${showContinue ? " is-ready" : ""}`}>
          <button
            type="button"
            id="btn-five-step0"
            className="btn btn-block setup-continue-btn"
            disabled={busy || !showContinue}
            aria-busy={busy}
            style={{ ["--continue-fill" as string]: fillPct }}
            onClick={goContinue}
          >
            <span className="setup-continue-fill" aria-hidden="true" />
            <span className="setup-continue-label">Continuar</span>
          </button>
        </div>
      </div>
    </div>,
    host,
  );
});
