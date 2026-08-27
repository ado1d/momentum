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
 * Bump CACHE ("momentum-v1" → "momentum-v2") to invalidate old caches;
 * the activate handler deletes everything that no longer matches.
 */
const CACHE = "momentum-v1";

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

  if (isApi(url)) {
    event.respondWith(apiNetworkFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(shellNetworkFirst(request));
  } else if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
  /* Anything else: no respondWith → default browser behaviour. */
});
