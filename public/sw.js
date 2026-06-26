const CACHE_NAME = "rotahr-v1";
const STATIC_ASSETS = [
  "/",
  "/auth/signin",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests, skip API and auth routes
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache fresh responses
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "Rotahr";
  // Payload structure: { title, body, data: { type, link } }
  const link = data.data?.link ?? data.url ?? "/dashboard";
  const options = {
    body: data.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: link },
    vibrate: [200, 100, 200],
    tag: data.data?.type ?? "rotahr", // collapse duplicate type notifications
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the exact deep-link page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  const fullUrl = url.startsWith("http") ? url : self.location.origin + url;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, navigate the existing tab
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) clients.openWindow(fullUrl);
    })
  );
});
