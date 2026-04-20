self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "FLH Dashboard",
    body: "dashboard-ში ახალი განახლებაა.",
    url: "/dashboard",
    tag: "flh-update",
    icon: "/apple-touch-icon.png",
    badge: "/pwa-icon/192",
    topic: "news",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (error) {
      console.error("Failed to parse push payload:", error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: {
        url: payload.url,
        topic: payload.topic,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
