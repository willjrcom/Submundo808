export type UsageFeature = 'heartbeat' | 'programacao' | 'mapa' | 'cardapio' | 'amigos';
const VISITOR_KEY = 'submundo-usage-device-v1';
const SESSION_KEY = 'submundo-usage-session-v1';
const SESSION_TOUCH_KEY = 'submundo-usage-session-touch-v1';
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INACTIVITY_MS = 30 * 60 * 1000;
let temporaryVisitorId = '';
let temporarySessionId = '';

function enabled(): boolean {
  return navigator.onLine && navigator.doNotTrack !== '1' && window.doNotTrack !== '1';
}
function visitorId(): string {
  if (temporaryVisitorId) return temporaryVisitorId;
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored && ID_PATTERN.test(stored)) return temporaryVisitorId = stored;
  } catch { /* Storage pode estar bloqueado. */ }
  temporaryVisitorId = crypto.randomUUID();
  try {localStorage.setItem(VISITOR_KEY,temporaryVisitorId);} catch { /* Apenas esta sessão. */ }
  return temporaryVisitorId;
}
function sessionId(): string {
  const now = Date.now();
  try {
    const prior = sessionStorage.getItem(SESSION_KEY);
    const last = Number(sessionStorage.getItem(SESSION_TOUCH_KEY));
    if (prior && ID_PATTERN.test(prior) && last && now - last < INACTIVITY_MS && now >= last) {
      sessionStorage.setItem(SESSION_TOUCH_KEY,String(now));
      return prior;
    }
    const next = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY,next);
    sessionStorage.setItem(SESSION_TOUCH_KEY,String(now));
    return next;
  } catch {
    if (!temporarySessionId) temporarySessionId = crypto.randomUUID();
    return temporarySessionId;
  }
}
function send(eventId: string, feature: UsageFeature | 'pause'): void {
  if (!eventId || !enabled()) return;
  const payload = JSON.stringify({eventId, visitorId: visitorId(), sessionId: sessionId(), feature});
  void fetch('/api/event-usage', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: {'Content-Type': 'application/json'},
    body: payload
  }).catch(() => { /* Estatísticas nunca interrompem o fluxo do participante. */ });
}
export function reportEventUsage(eventId: string, feature: UsageFeature): void {
  if (document.visibilityState !== 'visible') return;
  send(eventId,feature);
}
export function pauseEventUsage(eventId: string): void {
  send(eventId,'pause');
}
