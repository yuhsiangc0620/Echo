self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Echo",
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
    self.registration.showNotification(payload.title || "Echo", {
      body: payload.body || "有一顆包裝糖果剛掉進網路。",
      icon: "/echo-icon.svg",
      badge: "/echo-icon.svg",
      tag: "echo-candy-drop",
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((candidate) => "focus" in candidate);

      if (client) {
        return client.focus();
      }

      return self.clients.openWindow("/");
    }),
  );
});
