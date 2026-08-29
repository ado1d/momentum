/*
 * Momentum service worker — hand-written vanilla SW (no workbox, no deps).
 *
 * Strategies (same-origin GET only; everything else passes through untouched):
 *   • Static shell assets  (/_next/static/*, /icon*, /logo.svg,
 *     /manifest.webmanifest)                      → cache-first
 *   • App navigations (request.mode "navigate")   → network-first,
 *     offline fallback to the cached app shell "/"
 *   • GET /api/*                                  → network-first with
 *     cache-put (fresh data online; last good JSON offline, marked with
 *     an "X-Momentum-Cache: hit" response header)
 *   • POST/PATCH/DELETE + cross-origin requests   → untouched (no
 *     respondWith → browser default)
 *
 * Push notifications:
 *   • "push"            → shows a notification (title/body/tag/url payload)
 *   • "notificationclick" → focuses an open client or opens the app
 *   • "message"         → SKIP_WAITING lets a new SW activate immediately
 *
 * Bump CACHE ("momentum-v2" → "momentum-v3") to invalidate old caches;
 * the activate handler deletes everything that no longer matches.
 */
const CACHE = "momentum-v2";

/* Core shell pre-cached at install. Each entry is fetched individually so a
 * single failure (e.g. a missing icon) is skipped instead of failing install. */
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(
          SHELL_ASSETS.map((url) =>
            cache
              .add(new Request(url, { cache: "reload" }))
              .catch(() => {
                /* tolerate individual failures — install continues */
              }),
          ),
        );
      } catch {
        /* caches unavailable (e.g. private mode) — install anyway */
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name !== CACHE)
            .map((name) => caches.delete(name)),
        );
      } catch {
        /* best effort — stale caches can also be purged on next activate */
      }
      await self.clients.claim();
    })(),
  );
});

/* ── Push notifications ─────────────────────────────────────────── */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Momentum";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "momentum",
    data: { url: payload.url || "/" },
    // vibrate on Android; ignored elsewhere
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an already-open Momentum window when possible.
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if (client.url !== self.location.origin + url && "navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* navigation not allowed — focusing is enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* A waiting SW activates immediately when the page asks it to. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ── Route helpers ─────────────────────────────────────────────── */

const isApi = (url) => url.pathname.startsWith("/api/");
const isShellAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icon") ||
  url.pathname === "/logo.svg" ||
  url.pathname === "/manifest.webmanifest";

/* Cache-first: static assets rarely change — serve instantly, fill on miss. */
async function cacheFirst(request) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    /* cache unavailable → plain fetch below */
  }
  const response = await fetch(request);
  if (cache && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      /* quota / private mode — ignore */
    }
  }
  return response;
}

/* Network-first for navigations: fresh HTML when online, cached shell offline. */
async function shellNetworkFirst(request) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
  } catch {
    /* cache unavailable → network only */
  }
  try {
    const response = await fetch(request);
    if (cache && response.ok) {
      try {
        /* Keep the offline shell fresh — the SPA serves "/" for every view. */
        await cache.put("/", response.clone());
      } catch {
        /* ignore */
      }
    }
    return response;
  } catch (error) {
    const cached = cache ? await cache.match("/") : undefined;
    if (cached) return cached;
    return new Response(
      "Momentum is offline and no cached copy of the app is available yet.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
}

/* Network-first for GET /api/*: fresh data online; last good JSON offline. */
async function apiNetworkFirst(request) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
  } catch {
    /* cache unavailable → network only */
  }
  try {
    const response = await fetch(request);
    /* Only successful responses are cached — never poison with 404/500. */
    if (cache && response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch {
        /* ignore */
      }
    }
    return response;
  } catch (error) {
    if (cache) {
      const cached = await cache.match(request);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("X-Momentum-Cache", "hit");
        const body = await cached.blob();
        return new Response(body, {
          status: cached.status,
          statusText: cached.statusText,
          headers,
        });
      }
    }
    return new Response(
      JSON.stringify({ error: "Offline — no cached data for this request" }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "X-Momentum-Cache": "miss",
        },
      },
    );
  }
}

/* ── Fetch router ──────────────────────────────────────────────── */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /* Mutations (POST/PATCH/PUT/DELETE) and cross-origin traffic pass
   * through untouched — we never call respondWith for them. */
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Auth endpoints must NEVER be cached or intercepted — OAuth redirects,
   * session refreshes and CSRF flows need pristine network round-trips.
   * EXCEPTION: GET /api/auth/session is cached network-first so an offline
   * cold start (PWA opened with no network) still recognizes the signed-in
   * user instead of dropping to the login screen. Sign-out deletes ALL
   * caches (user-menu), so the session never outlives sign-out on disk. */
  if (url.pathname.startsWith("/api/auth/") && url.pathname !== "/api/auth/session") {
    return;
  }

  if (isApi(url)) {
    event.respondWith(apiNetworkFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(shellNetworkFirst(request));
  } else if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
  /* Anything else: no respondWith → default browser behaviour. */
});
