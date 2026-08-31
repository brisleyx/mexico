/**
 * First-touch UTMs + TikTok / Utmify pixels.
 * Server conversion (Utmify API) is sent from Edge Functions, not here.
 */

const STORAGE_KEY = "lamantra.tracking";
const LAST_PAYMENT_KEY = "lamantra.last-payment-id";
const PAID_PREFIX = "lamantra.tt-paid.";
const CHECKOUT_PREFIX = "lamantra.tt-checkout.";

const UTMIFY_KEYS = [
  "src",
  "sck",
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_content",
  "utm_term",
] as const;

export type TrackingParameters = {
  src: string | null;
  sck: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ttclid?: string | null;
};

type StoredTracking = TrackingParameters;

type Ttq = {
  page: (...args: unknown[]) => void;
  track: (event: string, params?: Record<string, unknown>, opts?: { event_id?: string }) => void;
  identify: (params: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    ttq?: Ttq;
    TikTokAnalyticsObject?: string;
    pixelId?: string;
  }
}

function emptyTracking(): TrackingParameters {
  return {
    src: null,
    sck: null,
    utm_source: null,
    utm_campaign: null,
    utm_medium: null,
    utm_content: null,
    utm_term: null,
  };
}

function readParam(search: URLSearchParams, key: string): string | null {
  const value = search.get(key)?.trim();
  return value ? value : null;
}

function loadStored(): StoredTracking | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTracking;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveStored(next: StoredTracking) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode
  }
}

function forApi(stored: StoredTracking): TrackingParameters {
  return {
    src: stored.src ?? null,
    sck: stored.sck ?? null,
    utm_source: stored.utm_source ?? null,
    utm_campaign: stored.utm_campaign ?? null,
    utm_medium: stored.utm_medium ?? null,
    utm_content: stored.utm_content ?? null,
    utm_term: stored.utm_term ?? null,
    ttclid: stored.ttclid ?? null,
  };
}

/** Merge current URL params into first-touch storage. New values overwrite; empty ones keep the landing click. */
export function captureTrackingFromLocation(): TrackingParameters {
  if (typeof window === "undefined") return emptyTracking();
  const search = new URLSearchParams(window.location.search);
  const next: StoredTracking = { ...(loadStored() ?? emptyTracking()) };
  let changed = false;

  for (const key of UTMIFY_KEYS) {
    const value = readParam(search, key);
    if (value && next[key] !== value) {
      next[key] = value;
      changed = true;
    }
  }

  const ttclid = readParam(search, "ttclid");
  if (ttclid && next.ttclid !== ttclid) {
    next.ttclid = ttclid;
    changed = true;
  }

  // Utmify has no ttclid field — put the click id in src so the order still matches TikTok.
  if (!next.src && next.ttclid) {
    next.src = next.ttclid;
    changed = true;
  }
  if (!next.utm_source && next.ttclid) {
    next.utm_source = "tiktok";
    changed = true;
  }

  if (changed || !loadStored()) saveStored(next);
  return forApi(next);
}

export function getTrackingForApi(): TrackingParameters {
  return captureTrackingFromLocation();
}

export function rememberPayment(id: string) {
  try {
    sessionStorage.setItem(LAST_PAYMENT_KEY, id);
  } catch {
    // private mode
  }
}

export function lastPaymentId(): string | null {
  try {
    return sessionStorage.getItem(LAST_PAYMENT_KEY);
  } catch {
    return null;
  }
}

function alreadyFired(prefix: string, id: string): boolean {
  try {
    if (sessionStorage.getItem(prefix + id)) return true;
    sessionStorage.setItem(prefix + id, "1");
    return false;
  } catch {
    return false;
  }
}

function injectTikTokPixel(pixelId: string) {
  if (document.querySelector("script[data-tiktok-pixel]")) {
    window.ttq?.page();
    return;
  }
  const script = document.createElement("script");
  script.dataset.tiktokPixel = pixelId;
  script.text = `!function (w, d, t) {
  w.TikTokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(obj,method){obj[method]=function(){obj.push([method].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(id){for(var e=ttq._i[id]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){
    var i="https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
    var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
    var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a);
  };
  ttq.load(${JSON.stringify(pixelId)});
  ttq.page();
}(window, document, 'ttq');`;
  document.head.appendChild(script);
}

function injectUtmifyPixel(pixelId: string) {
  if (document.querySelector("script[data-utmify-pixel]")) return;
  window.pixelId = pixelId;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";
  script.dataset.utmifyPixel = "1";
  document.head.appendChild(script);
}

export function bootTracking() {
  captureTrackingFromLocation();
  const utmifyPixel = import.meta.env.VITE_UTMIFY_PIXEL_ID?.trim();
  const tiktokPixel = import.meta.env.VITE_TIKTOK_PIXEL_ID?.trim();
  if (utmifyPixel) injectUtmifyPixel(utmifyPixel);
  if (tiktokPixel) injectTikTokPixel(tiktokPixel);
}

export function trackIdentify(email: string, name?: string) {
  const payload: Record<string, unknown> = {};
  if (email.trim()) payload.email = email.trim();
  if (name?.trim()) payload.external_id = name.trim();
  if (Object.keys(payload).length) window.ttq?.identify(payload);
}

export function trackInitiateCheckout(paymentId: string, valueMxn: number) {
  rememberPayment(paymentId);
  if (alreadyFired(CHECKOUT_PREFIX, paymentId)) return;
  window.ttq?.track(
    "InitiateCheckout",
    {
      contents: [{ content_id: paymentId, content_type: "product", content_name: "Transferencia SPEI" }],
      value: valueMxn,
      currency: "MXN",
    },
    { event_id: `${paymentId}-checkout` },
  );
}

export function trackCompletePayment(paymentId: string | null, valueMxn: number) {
  if (!paymentId) return;
  rememberPayment(paymentId);
  if (alreadyFired(PAID_PREFIX, paymentId)) return;
  window.ttq?.track(
    "CompletePayment",
    {
      contents: [{ content_id: paymentId, content_type: "product", content_name: "Transferencia SPEI" }],
      value: valueMxn,
      currency: "MXN",
    },
    { event_id: paymentId },
  );
}
