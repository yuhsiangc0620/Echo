self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Echo 🍬",
    body: "有一顆包裝糖果剛掉進網路。",
    data: {},
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json(),
      };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Echo 🍬", {
      body: payload.body || "有一顆包裝糖果剛掉進網路。",
      icon: "/echo-icon-192.png",
      badge: "/echo-icon-192.png",
      // Use a unique tag per candy so multiple candies each show their own
      // notification rather than collapsing into one.
      tag: `echo-candy-${payload.data?.candyId || Date.now()}`,
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Open the candy bag page so the user sees the new candy directly.
  const targetUrl = "/mobile";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If the app is already open, focus it and navigate.
      const existing = clients.find((c) => c.url.includes("/mobile") && "focus" in c);
      if (existing) {
        return existing.focus();
      }
      // Otherwise open a new tab.
      return self.clients.openWindow(targetUrl);
    }),
  );
});
