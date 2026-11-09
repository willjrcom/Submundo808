export type UsageFeature = 'heartbeat' | 'programacao' | 'mapa' | 'cardapio' | 'amigos';
const STORAGE_KEY = 'submundo-usage-device-v1';
let cachedId = '';
function visitorId(): string {
  if (cachedId) return cachedId;
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous && /^[0-9a-f-]{36}$/i.test(previous)) return cachedId = previous;
  } catch { /* Navegação privada pode bloquear o storage. */ }
  cachedId = crypto.randomUUID();
  try { localStorage.setItem(STORAGE_KEY, cachedId); } catch { /* Identificador apenas durante esta sessão. */ }
  return cachedId;
}

export function reportEventUsage(eventId: string, feature: UsageFeature): void {
  if (!eventId || !navigator.onLine || document.visibilityState !== 'visible' || navigator.doNotTrack === '1') return;
  void fetch('/api/event-usage', {
    method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({eventId, visitorId: visitorId(), feature})
  }).catch(() => { /* Telemetria nunca deve interromper a navegação. */ });
}
