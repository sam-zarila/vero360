self.addEventListener('push', event => {
  let data = {
    title: 'Vero360',
    body: 'New dashboard activity',
    url: '/dashboard',
  }
  try {
    const parsed = event.data ? event.data.json() : null
    if (parsed && typeof parsed === 'object') {
      data = {
        title: String(parsed.title || data.title),
        body: String(parsed.body || data.body),
        url: String(parsed.url || data.url),
      }
    }
  } catch {
    // keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      tag: 'vero-admin',
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const win of windows) {
        if (win.url.includes('/dashboard') && 'focus' in win) {
          win.navigate(url)
          return win.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
