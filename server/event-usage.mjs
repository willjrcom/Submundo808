import {createHmac} from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RETENTION_MS = 90 * DAY_MS;
const FEATURES = new Set(['heartbeat', 'programacao', 'mapa', 'cardapio', 'amigos']);
const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export function ensureEventUsageSchema(db, now = Date.now()) {
  db.exec('CREATE TABLE IF NOT EXISTS event_usage_buckets (' +
    'event_id TEXT NOT NULL, actor_key TEXT NOT NULL, feature TEXT NOT NULL,' +
    'hour_at INTEGER NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,' +
    'hits INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(event_id,actor_key,feature,hour_at));' +
    'CREATE INDEX IF NOT EXISTS idx_event_usage_day ON event_usage_buckets(event_id,hour_at);' +
    'CREATE INDEX IF NOT EXISTS idx_event_usage_live ON event_usage_buckets(last_seen);');
  pruneEventUsage(db, now);
}

export function pruneEventUsage(db, now = Date.now()) {
  db.prepare('DELETE FROM event_usage_buckets WHERE last_seen<?').run(now - RETENTION_MS);
}

export function recordEventUsage(db, data, {userId = null, secret, now = Date.now()} = {}) {
  const eventId = data?.eventId, visitorId = data?.visitorId, feature = data?.feature;
  if (typeof eventId !== 'string' || !EVENT_ID.test(eventId) ||
      typeof visitorId !== 'string' || !VISITOR_ID.test(visitorId) ||
      !FEATURES.has(feature) || typeof secret !== 'string' || !secret) {
    return {status: 400, body: {error: 'Dados de uso inválidos.'}};
  }
  if (!db.prepare('SELECT 1 FROM events WHERE id=? AND is_published=1').get(eventId)) {
    return {status: 404, body: {error: 'Evento indisponível.'}};
  }
  // Chave pseudônima, sem IP, GPS, e-mail ou UUID do visitante no banco.
  // Usuários logados são deduplicados entre dispositivos após autenticação.
  const identity = userId ? 'user:' + userId : 'visitor:' + visitorId.toLowerCase();
  const actorKey = createHmac('sha256', secret).update(identity).digest('hex');
  const hourAt = Math.floor(now / HOUR_MS) * HOUR_MS;
  db.prepare('INSERT INTO event_usage_buckets(event_id,actor_key,feature,hour_at,first_seen,last_seen,hits)' +
    ' VALUES(?,?,?,?,?,?,1) ON CONFLICT(event_id,actor_key,feature,hour_at)' +
    ' DO UPDATE SET last_seen=excluded.last_seen,hits=event_usage_buckets.hits+1')
    .run(eventId, actorKey, feature, hourAt, now, now);
  return {status: 202, body: {ok: true}};
}

export function brazilianDay(now = Date.now()) {
  return new Date(now - 3 * HOUR_MS).toISOString().slice(0, 10);
}

function dayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = Date.parse(day + 'T00:00:00-03:00');
  if (!Number.isFinite(start) || brazilianDay(start) !== day) return null;
  return [start, start + DAY_MS];
}

export function readEventUsage(db, {eventId = '', day = brazilianDay(), now = Date.now()} = {}) {
  const range = dayRange(day);
  if (!range) return {status: 400, body: {error: 'Data inválida.'}};
  if (eventId && (!EVENT_ID.test(eventId) || !db.prepare('SELECT 1 FROM events WHERE id=?').get(eventId))) {
    return {status: 404, body: {error: 'Evento não encontrado.'}};
  }
  const scoped = eventId ? 'event_id=? AND ' : '';
  const values = eventId ? [eventId] : [];
  const totals = db.prepare('SELECT COUNT(DISTINCT actor_key) AS unique_visitors,' +
    " COALESCE(SUM(CASE WHEN feature<>'heartbeat' THEN hits ELSE 0 END),0) AS interactions" +
    ' FROM event_usage_buckets WHERE ' + scoped + 'hour_at>=? AND hour_at<?')
    .get(...values, ...range);
  const active = db.prepare('SELECT COUNT(DISTINCT actor_key) AS n FROM event_usage_buckets' +
    ' WHERE ' + scoped + 'last_seen>?').get(...values, now - 15 * 60 * 1000);
  const features = db.prepare('SELECT feature, COUNT(DISTINCT actor_key) AS visitors, SUM(hits) AS hits' +
    ' FROM event_usage_buckets WHERE ' + scoped +
    "hour_at>=? AND hour_at<? AND feature<>'heartbeat' GROUP BY feature ORDER BY hits DESC")
    .all(...values, ...range).map(row => ({feature: row.feature, visitors: Number(row.visitors), hits: Number(row.hits)}));
  const hours = db.prepare('SELECT hour_at, COUNT(DISTINCT actor_key) AS visitors FROM event_usage_buckets' +
    ' WHERE ' + scoped + 'hour_at>=? AND hour_at<? GROUP BY hour_at ORDER BY hour_at')
    .all(...values, ...range).map(row => ({at: Number(row.hour_at), visitors: Number(row.visitors)}));
  const events = db.prepare('SELECT e.id,e.name,e.starts_at,' +
    ' COUNT(DISTINCT b.actor_key) AS visitors,' +
    " COALESCE(SUM(CASE WHEN b.feature<>'heartbeat' THEN b.hits ELSE 0 END),0) AS interactions" +
    ' FROM events e LEFT JOIN event_usage_buckets b ON b.event_id=e.id AND b.hour_at>=? AND b.hour_at<?' +
    ' GROUP BY e.id,e.name,e.starts_at ORDER BY e.starts_at DESC LIMIT 200')
    .all(...range).map(row => ({
      id: row.id, name: row.name, starts_at: row.starts_at,
      visitors: Number(row.visitors), interactions: Number(row.interactions)
    }));
  const linked = eventId ? Number(db.prepare('SELECT COUNT(*) AS n FROM event_participants WHERE event_id=?').get(eventId).n) : null;
  return {status: 200, body: {
    day, eventId: eventId || null, activeWindowMinutes: 15,
    uniqueVisitors: Number(totals.unique_visitors), activeNow: Number(active.n),
    interactions: Number(totals.interactions), linkedUsers: linked, events, features, hours,
    retentionDays: 90
  }};
}
