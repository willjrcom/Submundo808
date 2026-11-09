import {createHmac} from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const BRAZIL_OFFSET_MS = 3 * HOUR_MS;
const RETENTION_MS = 90 * DAY_MS;
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const MAX_ACTIVE_GAP_MS = 90_000;
const FEATURES = new Set(['heartbeat', 'programacao', 'mapa', 'cardapio', 'amigos', 'pause']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[a-zA-Z0-9_-]{1,100}$/;

export function ensureEventUsageSchema(db, now = Date.now()) {
  db.exec('CREATE TABLE IF NOT EXISTS event_usage_buckets (' +
    'event_id TEXT NOT NULL, actor_key TEXT NOT NULL, feature TEXT NOT NULL,' +
    'hour_at INTEGER NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,' +
    'hits INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(event_id,actor_key,feature,hour_at));' +
    'CREATE INDEX IF NOT EXISTS idx_event_usage_day ON event_usage_buckets(event_id,hour_at);' +
    'CREATE INDEX IF NOT EXISTS idx_event_usage_live ON event_usage_buckets(last_seen);' +
    'CREATE TABLE IF NOT EXISTS event_usage_sessions (' +
    'event_id TEXT NOT NULL, session_key TEXT NOT NULL, actor_key TEXT NOT NULL,' +
    'started_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,' +
    'active_ms INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0,' +
    'PRIMARY KEY(event_id,session_key));' +
    'CREATE INDEX IF NOT EXISTS idx_event_usage_sessions_period ON event_usage_sessions(event_id,started_at);');
  pruneEventUsage(db, now);
}

export function pruneEventUsage(db, now = Date.now()) {
  db.prepare('DELETE FROM event_usage_buckets WHERE last_seen<?').run(now - RETENTION_MS);
  db.prepare('DELETE FROM event_usage_sessions WHERE last_seen<?').run(now - RETENTION_MS);
}

const digest = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

export function recordEventUsage(db, data, {userId = null, secret, now = Date.now()} = {}) {
  const {eventId, visitorId, sessionId, feature} = data || {};
  if (typeof eventId !== 'string' || !EVENT_ID.test(eventId) ||
      typeof visitorId !== 'string' || !UUID.test(visitorId) ||
      typeof sessionId !== 'string' || !UUID.test(sessionId) ||
      !FEATURES.has(feature) || typeof secret !== 'string' || !secret) {
    return {status: 400, body: {error: 'Dados de uso inválidos.'}};
  }
  if (!db.prepare('SELECT 1 FROM events WHERE id=? AND is_published=1').get(eventId)) {
    return {status: 404, body: {error: 'Evento indisponível.'}};
  }
  // Somente pseudônimos HMAC persistidos; nunca UUID, IP, e-mail ou posição GPS.
  const identity = userId ? 'user:' + userId : 'visitor:' + visitorId.toLowerCase();
  const actorKey = digest(secret, identity);
  const sessionKey = digest(secret, 'session:' + sessionId.toLowerCase());
  const previous = db.prepare('SELECT last_seen,active_ms,paused FROM event_usage_sessions WHERE event_id=? AND session_key=?')
    .get(eventId, sessionKey);
  const gap = previous ? now - Number(previous.last_seen) : 0;
  const increment = previous && !Number(previous.paused) && gap > 0 && gap <= MAX_ACTIVE_GAP_MS ? gap : 0;
  db.prepare('INSERT INTO event_usage_sessions(event_id,session_key,actor_key,started_at,last_seen,active_ms,paused)' +
    ' VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id,session_key)' +
    ' DO UPDATE SET actor_key=excluded.actor_key,last_seen=excluded.last_seen,' +
    ' active_ms=excluded.active_ms,paused=excluded.paused')
    .run(eventId, sessionKey, actorKey, now, now,
      (previous ? Number(previous.active_ms) : 0) + increment, feature === 'pause' ? 1 : 0);
  if (feature !== 'pause') {
    const hourAt = Math.floor(now / HOUR_MS) * HOUR_MS;
    db.prepare('INSERT INTO event_usage_buckets(event_id,actor_key,feature,hour_at,first_seen,last_seen,hits)' +
      ' VALUES(?,?,?,?,?,?,1) ON CONFLICT(event_id,actor_key,feature,hour_at)' +
      ' DO UPDATE SET last_seen=excluded.last_seen,hits=event_usage_buckets.hits+1')
      .run(eventId, actorKey, feature, hourAt, now, now);
  }
  return {status: 202, body: {ok: true}};
}

// Current operational timezone is America/Sao_Paulo (UTC-03, no DST).
export function brazilianDay(now = Date.now()) {
  return new Date(now - BRAZIL_OFFSET_MS).toISOString().slice(0, 10);
}
function dayRange(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = Date.parse(day + 'T00:00:00-03:00');
  if (!Number.isFinite(start) || brazilianDay(start) !== day) return null;
  return [start, start + DAY_MS];
}
function resolvePeriod({period, day, from, to, now}) {
  const today = brazilianDay(now);
  const kind = period || 'today';
  if (!['today', '7d', '30d', 'custom'].includes(kind)) return null;
  if (kind === 'custom') {
    const first = dayRange(from), last = dayRange(to);
    if (!first || !last || first[0] > last[0] || (last[1] - first[0]) > RETENTION_MS) return null;
    return {kind, from, to, start: first[0], end: last[1], days: (last[1] - first[0]) / DAY_MS};
  }
  const lastDay = kind === 'today' ? (day || today) : today;
  const last = dayRange(lastDay);
  if (!last) return null;
  const days = kind === '7d' ? 7 : kind === '30d' ? 30 : 1;
  const start = last[1] - days * DAY_MS;
  return {kind, from: brazilianDay(start), to: lastDay, start, end: last[1], days};
}
function scopedValues(eventId) {
  return {scope: eventId ? 'event_id=? AND ' : '', args: eventId ? [eventId] : []};
}
const count = value => Number(value || 0);
const timelineDayExpression = column =>
  '((' + column + '-' + BRAZIL_OFFSET_MS + ')/' + DAY_MS + ')*' + DAY_MS + '+' + BRAZIL_OFFSET_MS;

export function readEventUsage(db, {
  eventId = '', day = brazilianDay(), period = 'today', from = '', to = '', now = Date.now()
} = {}) {
  const range = resolvePeriod({period, day, from, to, now});
  if (!range) return {status: 400, body: {error: 'Período ou data inválidos.'}};
  if (eventId && (!EVENT_ID.test(eventId) || !db.prepare('SELECT 1 FROM events WHERE id=?').get(eventId))) {
    return {status: 404, body: {error: 'Evento não encontrado.'}};
  }
  const {scope, args} = scopedValues(eventId);
  const bounded = [...args, range.start, range.end];
  const total = db.prepare('SELECT COUNT(DISTINCT actor_key) AS unique_visitors,' +
    " COALESCE(SUM(CASE WHEN feature<>'heartbeat' THEN hits ELSE 0 END),0) AS interactions" +
    ' FROM event_usage_buckets WHERE ' + scope + 'hour_at>=? AND hour_at<?').get(...bounded);
  const sessions = db.prepare('SELECT COUNT(DISTINCT session_key) AS opens,' +
    ' COALESCE(SUM(active_ms),0) AS total_active_ms FROM event_usage_sessions' +
    ' WHERE ' + scope + 'started_at>=? AND started_at<?').get(...bounded);
  const active = db.prepare('SELECT COUNT(DISTINCT actor_key) AS n FROM event_usage_buckets' +
    ' WHERE ' + scope + 'last_seen>? AND last_seen<=?').get(...args, now - ACTIVE_WINDOW_MS, now);

  const features = db.prepare('SELECT feature,COUNT(DISTINCT actor_key) AS visitors,SUM(hits) AS hits' +
    ' FROM event_usage_buckets WHERE ' + scope +
    "hour_at>=? AND hour_at<? AND feature<>'heartbeat' GROUP BY feature ORDER BY hits DESC")
    .all(...bounded).map(row => ({feature: row.feature, visitors: count(row.visitors), hits: count(row.hits)}));

  const previousStart = range.start - range.days * DAY_MS;
  const previousAvailable = previousStart >= now - RETENTION_MS;
  let previousUsers = 0, returningUsers = 0;
  if (previousAvailable) {
    previousUsers = count(db.prepare('SELECT COUNT(DISTINCT actor_key) AS n FROM event_usage_buckets' +
      ' WHERE ' + scope + 'hour_at>=? AND hour_at<?').get(...args, previousStart, range.start).n);
    if (previousUsers) {
      returningUsers = count(db.prepare('SELECT COUNT(DISTINCT actor_key) AS n FROM event_usage_buckets' +
        ' WHERE ' + scope + 'hour_at>=? AND hour_at<? AND actor_key IN (' +
        ' SELECT DISTINCT actor_key FROM event_usage_buckets WHERE ' + scope +
        'hour_at>=? AND hour_at<?)').get(...args, range.start, range.end, ...args, previousStart, range.start).n);
    }
  }

  const unit = range.days === 1 ? 'hour' : 'day';
  const bucketExpr = unit === 'hour' ? 'hour_at' : timelineDayExpression('hour_at');
  const sessionExpr = unit === 'hour'
    ? '(started_at/' + HOUR_MS + ')*' + HOUR_MS
    : timelineDayExpression('started_at');
  const usageTimeline = db.prepare('SELECT ' + bucketExpr + ' AS bucket,COUNT(DISTINCT actor_key) AS visitors' +
    ' FROM event_usage_buckets WHERE ' + scope +
    'hour_at>=? AND hour_at<? GROUP BY ' + bucketExpr).all(...bounded);
  const sessionTimeline = db.prepare('SELECT ' + sessionExpr + ' AS bucket,COUNT(DISTINCT session_key) AS opens' +
    ' FROM event_usage_sessions WHERE ' + scope +
    'started_at>=? AND started_at<? GROUP BY ' + sessionExpr).all(...bounded);
  const timelineMap = new Map();
  const step = unit === 'hour' ? HOUR_MS : DAY_MS;
  for (let at = range.start; at < range.end; at += step) {
    timelineMap.set(at, {at, visitors: 0, opens: 0});
  }
  for (const row of usageTimeline) {
    const point = timelineMap.get(count(row.bucket));
    if (point) point.visitors = count(row.visitors);
  }
  for (const row of sessionTimeline) {
    const point = timelineMap.get(count(row.bucket));
    if (point) point.opens = count(row.opens);
  }

  const eventRows = db.prepare('SELECT e.id,e.name,e.starts_at,e.ends_at,' +
    ' COUNT(DISTINCT b.actor_key) AS visitors,' +
    " COALESCE(SUM(CASE WHEN b.feature<>'heartbeat' THEN b.hits ELSE 0 END),0) AS interactions" +
    ' FROM events e LEFT JOIN event_usage_buckets b ON b.event_id=e.id AND b.hour_at>=? AND b.hour_at<?' +
    ' GROUP BY e.id,e.name,e.starts_at,e.ends_at ORDER BY e.starts_at DESC LIMIT 200').all(range.start, range.end);
  const eventSessions = db.prepare('SELECT event_id,COUNT(DISTINCT session_key) AS opens,' +
    ' COALESCE(SUM(active_ms),0) AS total_active_ms FROM event_usage_sessions' +
    ' WHERE started_at>=? AND started_at<? GROUP BY event_id').all(range.start, range.end);
  const eventLive = db.prepare('SELECT event_id,COUNT(DISTINCT actor_key) AS active' +
    ' FROM event_usage_buckets WHERE last_seen>? AND last_seen<=? GROUP BY event_id')
    .all(now - ACTIVE_WINDOW_MS, now);
  const sessionsByEvent = new Map(eventSessions.map(row => [row.event_id, row]));
  const liveByEvent = new Map(eventLive.map(row => [row.event_id, count(row.active)]));
  const events = eventRows.map(row => {
    const record = sessionsByEvent.get(row.id);
    const opens = count(record?.opens);
    return {id: row.id, name: row.name, starts_at: row.starts_at, ends_at: row.ends_at,
      visitors: count(row.visitors), interactions: count(row.interactions),
      opens, activeNow: liveByEvent.get(row.id) || 0,
      avgSessionSeconds: opens ? Math.round(count(record?.total_active_ms) / opens / 1000) : null};
  });
  const opens = count(sessions.opens);
  const linkedUsers = eventId ? count(db.prepare('SELECT COUNT(*) AS n FROM event_participants WHERE event_id=?').get(eventId).n) : null;
  return {status: 200, body: {
    eventId: eventId || null, day: range.to, period: range.kind, from: range.from, to: range.to,
    timelineUnit: unit, timeline: [...timelineMap.values()],
    uniqueVisitors: count(total.unique_visitors), interactions: count(total.interactions),
    appOpens: opens, avgSessionSeconds: opens ? Math.round(count(sessions.total_active_ms) / opens / 1000) : null,
    activeNow: count(active.n), activeWindowMinutes: 15,
    retentionPercent: previousAvailable && previousUsers ? Math.round(1000 * returningUsers / previousUsers) / 10 : null,
    previousPeriodVisitors: previousUsers, returningVisitors: returningUsers,
    linkedUsers, events, features, retentionDays: 90
  }};
}
