import {createOauth} from './oauth.mjs';
import {allowPostOrigin,clientIp,createWindowLimiter,publicAppOrigin,securityHeaders} from './request-security.mjs';
import {loadJwtSecret,signJwt,verifyJwt,authCookie,JWT_COOKIE_NAME} from './auth.mjs';
import {validateDemoLocation,DEMO_MARKERS} from './demo-geolocation.mjs';
import {insertDefaultMapAreas} from './default-map-layout.mjs';
import {ensureDemoData} from './demo-seed.mjs';
import {ensureDemoShowcase} from './demo-showcase.mjs';
import {ensureDemoNotifications} from './demo-notifications.mjs';
import {ensurePushQueueSchema,notificationTransaction,addNotificationReceipt,publishDueNotificationReceipts,processPendingPushes} from './notification-delivery.mjs';
import {resolveSharingExpiry,expireLocationShares,LOCATION_FRESH_MS} from './location-sharing.mjs';
import http from 'node:http';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 80);
const DATA = process.env.DATA_DIR || '/data';
const PUBLIC = '/app/public';
fs.mkdirSync(DATA, { recursive: true });
const secretFile=path.join(DATA,'friend-invite-secret');
if(!fs.existsSync(secretFile))fs.writeFileSync(secretFile,randomBytes(32).toString('hex'),{mode:0o600});
const FRIEND_SECRET=process.env.FRIEND_INVITE_SECRET||fs.readFileSync(secretFile,'utf8').trim();
const db = new DatabaseSync(path.join(DATA, 'submundo.sqlite'));
const JWT_SECRET=loadJwtSecret(DATA);
const PUBLIC_APP_ORIGIN=publicAppOrigin();
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friend_codes (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships (user_a TEXT NOT NULL, user_b TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_a,user_b));
CREATE TABLE IF NOT EXISTS friend_invites (user_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS live_locations (user_id TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL NOT NULL, updated_at INTEGER NOT NULL);`);
for(const [column,def] of [['phone',"TEXT NOT NULL DEFAULT ''"],['instagram',"TEXT NOT NULL DEFAULT ''"]]){if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name===column))db.exec('ALTER TABLE users ADD COLUMN '+column+' '+def);}
db.exec('CREATE TABLE IF NOT EXISTS admin_users(user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='avatar_data'))db.exec("ALTER TABLE users ADD COLUMN avatar_data TEXT NOT NULL DEFAULT ''");
db.exec("CREATE TABLE IF NOT EXISTS push_subscriptions(user_id TEXT NOT NULL,endpoint TEXT NOT NULL PRIMARY KEY,subscription_json TEXT NOT NULL,created_at INTEGER NOT NULL)");
db.exec(`CREATE TABLE IF NOT EXISTS event_participants (
 event_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 first_selected_at INTEGER NOT NULL,
 last_selected_at INTEGER NOT NULL,
 PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id,last_selected_at);
CREATE TABLE IF NOT EXISTS event_reviews (
 event_id TEXT NOT NULL,user_id TEXT NOT NULL,rating INTEGER NOT NULL,
 tags_json TEXT NOT NULL DEFAULT '[]',comment TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
 PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY,event_id TEXT,title TEXT NOT NULL,body TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'info',target_kind TEXT NOT NULL DEFAULT 'event',
 target_id TEXT NOT NULL DEFAULT '',audience TEXT NOT NULL DEFAULT 'event',
 status TEXT NOT NULL DEFAULT 'draft',scheduled_at INTEGER,
 created_by TEXT NOT NULL,created_at INTEGER NOT NULL,sent_at INTEGER
);
CREATE TABLE IF NOT EXISTS notification_receipts (
 notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER,
 PRIMARY KEY(notification_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_user ON notification_receipts(user_id,read_at);`);

db.exec(`CREATE TABLE IF NOT EXISTS venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,gps_json TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));`);
// Campos estruturados de localização, mantendo address para registros legados.
for(const [column,definition] of [['postal_code',"TEXT NOT NULL DEFAULT ''"],['street',"TEXT NOT NULL DEFAULT ''"],['neighborhood',"TEXT NOT NULL DEFAULT ''"],['complement',"TEXT NOT NULL DEFAULT ''"],['address_url',"TEXT NOT NULL DEFAULT ''"]]){
 if(!db.prepare('PRAGMA table_info(venues)').all().some(field=>field.name===column))db.exec('ALTER TABLE venues ADD COLUMN '+column+' '+definition);
}
if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='meaple_event_id'))db.exec("ALTER TABLE events ADD COLUMN meaple_event_id TEXT NOT NULL DEFAULT ''");
for(const table of ['venues','events'])for(const [col,def] of (table==='venues'?[['services',"TEXT NOT NULL DEFAULT ''"]]:[['doors_at',"TEXT NOT NULL DEFAULT ''"],['cover_image',"TEXT NOT NULL DEFAULT ''"],['services',"TEXT NOT NULL DEFAULT ''"]])){
 if(!db.prepare('PRAGMA table_info('+table+')').all().some(row=>row.name===col))db.exec('ALTER TABLE '+table+' ADD COLUMN '+col+' '+def);
}
db.exec('CREATE TABLE IF NOT EXISTS event_general_settings(id INTEGER PRIMARY KEY CHECK(id=1),minimum_age INTEGER NOT NULL DEFAULT 18,entry_rules TEXT NOT NULL DEFAULT \'\',accepted_documents TEXT NOT NULL DEFAULT \'\',cancellation_policy TEXT NOT NULL DEFAULT \'\')');
const DEFAULT_EVENT_PREFERENCES={
 minimum_age:18,
 entry_rules:"Entrada proibida para menores de 18 anos.\nNão são permitidas camisetas de times nacionais (permitidas camisetas de times internacionais e seleções).\nNão são permitidos chinelos ou calçados que não estejam presos aos pés.\nNão são permitidas câmeras profissionais.\nNão são permitidos produtos inflamáveis.\nNão é permitida a entrada com bebidas de qualquer tipo.\nNão são permitidos perfumes e desodorantes aerossóis.\nNão são permitidos copos térmicos, recipientes de alumínio, metal ou vidro.\nNão são permitidos objetos cortantes, inclusive tesouras pequenas.\nNão são permitidas drogas ilícitas, armas brancas ou armas de fogo.\nO evento não é open bar.",
 accepted_documents:"A entrada exige documento original com foto ou documento digital exibido em aplicativo oficial.\nNão são aceitas fotos de documentos ou arquivos PDF fora dos aplicativos oficiais.\nDocumentos aceitos: RG, CIN, CNH, Carteira de Trabalho (somente física), Passaporte, Título de Eleitor (somente pelo aplicativo e-Título) e Carteira de Reservista.",
 cancellation_policy:"Cancelamentos de pedidos pagos serão aceitos até 7 dias após a compra, desde que a solicitação seja enviada até 48 horas antes do início do evento."
};
for(const [column,type] of [['contact_name',"TEXT NOT NULL DEFAULT ''"],['contact_phone',"TEXT NOT NULL DEFAULT ''"]]){if(!db.prepare('PRAGMA table_info(event_general_settings)').all().some(row=>row.name===column))db.exec('ALTER TABLE event_general_settings ADD COLUMN '+column+' '+type);}
db.prepare('INSERT OR IGNORE INTO event_general_settings(id,minimum_age,entry_rules,accepted_documents,cancellation_policy) VALUES(1,?,?,?,?)').run(DEFAULT_EVENT_PREFERENCES.minimum_age,DEFAULT_EVENT_PREFERENCES.entry_rules,DEFAULT_EVENT_PREFERENCES.accepted_documents,DEFAULT_EVENT_PREFERENCES.cancellation_policy);
// Atualiza apenas instalações ainda com os três campos vazios (estado inicial antigo).
// Não reverte personalizações do administrador em inicializações posteriores.
db.prepare("UPDATE event_general_settings SET entry_rules=?,accepted_documents=?,cancellation_policy=? WHERE id=1 AND entry_rules='' AND accepted_documents='' AND cancellation_policy=''").run(DEFAULT_EVENT_PREFERENCES.entry_rules,DEFAULT_EVENT_PREFERENCES.accepted_documents,DEFAULT_EVENT_PREFERENCES.cancellation_policy);
db.exec("CREATE TABLE IF NOT EXISTS app_branding(id INTEGER PRIMARY KEY CHECK(id=1),logo_data TEXT NOT NULL DEFAULT '')");
db.prepare('INSERT OR IGNORE INTO app_branding(id) VALUES(1)').run();
if(!db.prepare('PRAGMA table_info(app_branding)').all().some(c=>c.name==='accent_color'))db.exec("ALTER TABLE app_branding ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#c4ff40'");
db.exec("CREATE TABLE IF NOT EXISTS map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL DEFAULT '[]')");
db.exec('CREATE TABLE IF NOT EXISTS user_activity(user_id TEXT PRIMARY KEY,last_seen INTEGER NOT NULL)');
if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='is_published')) db.exec('ALTER TABLE events ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1');
const DEFAULT_MAP_FRAME={x:22,y:22,width:56,height:56};
const isValidMapFrame=f=>f&&typeof f==='object'&&!Array.isArray(f)&&
 [f.x,f.y,f.width,f.height].every(n=>typeof n==='number'&&Number.isFinite(n))&&
 f.x>=0&&f.y>=0&&f.width>=18&&f.height>=18&&f.x+f.width<=100.00001&&f.y+f.height<=100.00001;
const frameOf=row=>{
 try{const f=JSON.parse(row?.frame_json||'null');return isValidMapFrame(f)?f:{...DEFAULT_MAP_FRAME};}
 catch{return {...DEFAULT_MAP_FRAME};}
};
if(!db.prepare('PRAGMA table_info(venue_maps)').all().some(c=>c.name==='frame_json'))
 db.exec("ALTER TABLE venue_maps ADD COLUMN frame_json TEXT NOT NULL DEFAULT '{\"x\":22,\"y\":22,\"width\":56,\"height\":56}'");
db.exec('CREATE TABLE IF NOT EXISTS location_preferences(user_id TEXT PRIMARY KEY,gps_enabled INTEGER NOT NULL DEFAULT 0,share_enabled INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)');
for(const [column,definition] of [
 ['share_mode',"TEXT NOT NULL DEFAULT 'event'"],
 ['share_expires_at','INTEGER'],
 ['share_event_id','TEXT']
]){
 if(!db.prepare('PRAGMA table_info(location_preferences)').all().some(c=>c.name===column))db.exec('ALTER TABLE location_preferences ADD COLUMN '+column+' '+definition);
}
expireLocationShares(db);
const locationCleanupTimer=setInterval(()=>{
 try{expireLocationShares(db);}catch(e){console.error('Location-sharing cleanup failed',e);}
},60_000);
locationCleanupTimer.unref?.();
db.exec("CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL)");
db.exec('CREATE TABLE IF NOT EXISTS event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id))');
for(const [column,definition] of [['description',"TEXT NOT NULL DEFAULT ''"],['color',"TEXT NOT NULL DEFAULT '#9747FF'"],['icon',"TEXT NOT NULL DEFAULT ''"]]){
 if(!db.prepare('PRAGMA table_info(map_areas)').all().some(c=>c.name===column))db.exec('ALTER TABLE map_areas ADD COLUMN '+column+' '+definition);
}
if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='token_version'))db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
if(adminEmail){const row=db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail);if(row)db.prepare('INSERT OR IGNORE INTO admin_users VALUES(?,?)').run(row.id,Date.now());}
const isAdmin=user=>!!user&&!!db.prepare('SELECT 1 FROM admin_users WHERE user_id=?').get(user.id);
const json = (res, status, body, headers={}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const hashToken = value => createHash('sha256').update(value).digest('hex');
const passwordHash = pass => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(pass, salt, 64).toString('hex'); };
const validPassword = (pass, stored) => { const [salt, expected] = stored.split(':'); if (!salt || !expected) return false; const actual = scryptSync(pass, salt, 64); const wanted = Buffer.from(expected, 'hex'); return actual.length === wanted.length && timingSafeEqual(actual, wanted); };
const cookie = (req, key) => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(key + '='))?.slice(key.length + 1);
const getUser = req => {
  const claims=verifyJwt(cookie(req,JWT_COOKIE_NAME),JWT_SECRET);
  if(!claims)return null;
  const user=db.prepare('SELECT id,name,email,phone,instagram,avatar_data,token_version FROM users WHERE id=?').get(claims.sub);
  if(!user||user.token_version!==claims.ver)return null;
  db.prepare('INSERT INTO user_activity(user_id,last_seen) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').run(user.id,Date.now());
  return {id:user.id,name:user.name,email:user.email,phone:user.phone||'',instagram:user.instagram||'',avatar:user.avatar_data||''};
};
const sessionCookie=authCookie;
const createSession=(req,res,id)=>{
  const user=db.prepare('SELECT token_version FROM users WHERE id=?').get(id);
  if(!user)throw Error('Usuário não encontrado');
  res.setHeader('Set-Cookie',authCookie(signJwt(id,user.token_version,JWT_SECRET),undefined,req));
};
const oauthHandler=createOauth({db,getUser,createSession,passwordHash,secret:JWT_SECRET});
// O limite geral evita abuso sem punir todos os participantes de um mesmo evento.
const generalPostLimit=createWindowLimiter({limit:1200,windowMs:60_000});
const loginLimit=createWindowLimiter({limit:10,windowMs:10*60_000});
const trustedProxy=process.env.TRUST_PROXY==='true';
const requestIp=req=>clientIp(req,{trustProxy:trustedProxy});
const loginKey=(req,email)=>requestIp(req)+':'+email;
function limited(req){return generalPostLimit.hit(requestIp(req));}
async function body(req) { let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>200000) throw Error('Payload muito grande'); } return JSON.parse(raw || '{}'); }
async function sendReset(email, link) {
  if (!process.env.RESEND_API_KEY || !process.env.RESET_FROM_EMAIL) return false;
  const result = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'}, body:JSON.stringify({from:process.env.RESET_FROM_EMAIL,to:[email],subject:'Redefinir senha — Submundo 808',text:'Para redefinir sua senha, abra este link (válido por 30 minutos): '+link}) });
  if (!result.ok) throw Error('Falha no serviço de e-mail');
  return true;
}
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
// Durante o desenvolvimento, mantenha os dados de exemplo disponíveis sem
// precisar clicar no botão do admin. É idempotente, não altera dados editados
// e pode ser desligado quando a plataforma entrar em produção.
// O container usa NODE_ENV=production mesmo no piloto. APP_ENV=production
// ativa o modo comercial e exige opt-in explícito para dados demonstrativos.
if(process.env.AUTO_SEED_DEMO==='true'||(process.env.APP_ENV!=='production'&&process.env.AUTO_SEED_DEMO!=='false')){
 try{
  const initial=ensureDemoData(db);
  const showcase=ensureDemoShowcase(db,{baseEventId:initial.id});
  const templates=ensureDemoNotifications(db,{eventId:initial.id});
  console.log('POC catalog ready:',initial.created?'created':'reused',initial.id,'showcase events added:',showcase.eventsAdded,'showcase maps added:',showcase.mapsAdded,'notification templates added:',templates.count);
 }catch(error){
  console.error('Could not initialize sample data:',error);
 }
}
ensurePushQueueSchema(db);
const VAPID_PUBLIC=process.env.VAPID_PUBLIC_KEY||'';
const VAPID_PRIVATE=process.env.VAPID_PRIVATE_KEY||'';
if(VAPID_PUBLIC&&VAPID_PRIVATE)webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@submundo808.com',VAPID_PUBLIC,VAPID_PRIVATE);
let pushQueueBusy=false;
async function drainPushQueue(){
 if(pushQueueBusy)return;
 pushQueueBusy=true;
 try{
  // A fila fica no SQLite e sobrevive ao reinício. Não processar em paralelo
  // neste servidor; cada lote tem concorrência limitada no módulo da fila.
  for(let i=0;i<20;i++){
   const result=await processPendingPushes(db,(subscription,payload,options)=>webpush.sendNotification(subscription,payload,options),{batchSize:50,pushConfigured:!!(VAPID_PUBLIC&&VAPID_PRIVATE)});
   if(result.processed<50)break;
  }
 }catch(error){console.error('push queue processing:',error?.message||error);}
 finally{pushQueueBusy=false;}
}
function eventEndMillis(value){
 const normalized=String(value||'');
 // Event dates are authored as Brazilian venue-local datetime-local values.
 // Explicit offsets are respected; otherwise use São Paulo standard time.
 return Date.parse(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?$/.test(normalized)?normalized+'-03:00':normalized);
}
function dispatchDueNotifications(){
 const now=Date.now();
 // Uma notificação gerada por evento tem chave determinística para evitar duplicações.
 const finished=db.prepare("SELECT id,name,ends_at FROM events WHERE is_published=1 AND ends_at<>''").all();
 for(const event of finished){
  const ends=eventEndMillis(event.ends_at);
  if(!Number.isFinite(ends)||now<ends||now>ends+7*86400000)continue;
  const id='survey-'+event.id;
  db.prepare("INSERT OR IGNORE INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id,event.id,'Como foi a '+event.name+'? ⭐','Avalie sua experiência e ajude a melhorar a próxima festa.','survey','survey','', 'event','pending',null,'system',now);
 }
 publishDueNotificationReceipts(db,now);
}
try{dispatchDueNotifications();void drainPushQueue();}catch(e){console.error('notification dispatch startup:',e);}
const notificationInterval=setInterval(()=>{try{dispatchDueNotifications();void drainPushQueue();}catch(e){console.error('notification dispatch:',e);}},15000);
notificationInterval.unref?.();

http.createServer(async (req,res)=>{
  for(const [name,value] of Object.entries(securityHeaders(req)))res.setHeader(name,value);
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if(await oauthHandler(req,res,url)!==false)return;
      if (req.method === 'POST') {
        if(!allowPostOrigin(req))return json(res,403,{error:'Origem inválida'});
        if (limited(req)) return json(res,429,{error:'Muitas tentativas. Aguarde um minuto.'});
      }
      // Client error telemetry: avoid personal data, URLs with query strings, and raw stack traces.
      if(url.pathname==='/api/client-errors'&&req.method==='POST'){
        const payload=await body(req);
        const page=String(payload.page||'').replace(/[^a-zA-Z0-9/_-]/g,'').slice(0,160);
        const component=String(payload.component||'').replace(/[^a-zA-Z0-9 _.-]/g,'').slice(0,100);
        const code=String(payload.code||'client_exception').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
        const errorType=String(payload.errorType||'Error').replace(/[^a-zA-Z]/g,'').slice(0,40);
        const diagnostic=String(payload.diagnostic||'').replace(/https?:\/\/\S+/gi,'[url]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email]').replace(/\b\d{10,}\b/g,'[number]').replace(/[\r\n\t]/g,' ').slice(0,220);
        console.error(JSON.stringify({level:'error',source:'frontend',timestamp:new Date().toISOString(),page,component,code,errorType,diagnostic}));
        return json(res,202,{ok:true});
      }
      if (url.pathname==='/api/friends/code' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        let invite=db.prepare('SELECT token_hash FROM friend_invites WHERE user_id=?').get(user.id);
        // A token is stored encrypted at rest so we cannot return it later; instead issue
        // a deterministic opaque signed token derived from a server secret.
        const secret=FRIEND_SECRET;
        const token=createHash('sha256').update('friend-v1:'+user.id+':'+secret).digest('hex');
        if(!invite || invite.token_hash!==hashToken(token)){
          db.prepare('INSERT INTO friend_invites(user_id,token_hash) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash').run(user.id,hashToken(token));
        }
        return json(res,200,{token});
      }
      if (url.pathname==='/api/friends/add' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);let token=String(b.token||'');
        try {if(token.includes('://'))token=new URL(token).searchParams.get('invite')||'';}catch{}
        if(!/^[a-f0-9]{64}$/.test(token))return json(res,400,{error:'QR Code ou link inválido. Peça o novo link permanente.'});
        const row=db.prepare('SELECT i.user_id,u.name FROM friend_invites i JOIN users u ON u.id=i.user_id WHERE i.token_hash=?').get(hashToken(token));
        if(!row)return json(res,404,{error:'Convite não encontrado. Peça para a pessoa abrir o perfil e gerar seu QR Code.'});
        if(row.user_id===user.id)return json(res,400,{error:'Você não pode adicionar a si mesmo.'});
        const [a,bId]=[user.id,row.user_id].sort();
        db.prepare('INSERT OR IGNORE INTO friendships VALUES(?,?,?)').run(a,bId,Date.now());
        return json(res,200,{ok:true,friend:{id:row.user_id,name:row.name}});
      }
      if (url.pathname==='/api/friends' && req.method==='GET') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const rows=db.prepare('SELECT u.id,u.name FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE f.user_a=? OR f.user_b=? ORDER BY u.name').all(user.id,user.id,user.id);
        return json(res,200,{friends:rows});
      }
      if (url.pathname==='/api/friends/remove' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);const id=String(b.id||'');
        const [a,bId]=[user.id,id].sort();db.prepare('DELETE FROM friendships WHERE user_a=? AND user_b=?').run(a,bId);
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/location/preferences'&&req.method==='GET'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const now=Date.now();expireLocationShares(db,now);
        const row=db.prepare('SELECT gps_enabled,share_enabled,share_mode,share_expires_at,share_event_id FROM location_preferences WHERE user_id=?').get(user.id);
        const shareEnabled=!!row?.share_enabled&&row.share_expires_at>now;
        return json(res,200,{
          gpsEnabled:shareEnabled&&!!row?.gps_enabled,shareEnabled,
          mode:row?.share_mode||'event',eventId:shareEnabled?row?.share_event_id||null:null,
          expiresAt:shareEnabled?row.share_expires_at:null
        });
      }
      if(url.pathname==='/api/location/preferences'&&req.method==='POST'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);
        if(typeof b.gpsEnabled!=='boolean'||typeof b.shareEnabled!=='boolean'||(b.shareEnabled&&!b.gpsEnabled))return json(res,400,{error:'Preferências inválidas.'});
        const now=Date.now();
        let choice=null;
        if(b.shareEnabled){
          if(typeof b.eventId!=='string'||!b.eventId||b.eventId.length>100||
             !db.prepare('SELECT 1 FROM events WHERE id=?').get(b.eventId)){
            return json(res,400,{error:'Escolha um evento válido antes de compartilhar sua localização.'});
          }
          try{choice=resolveSharingExpiry(db,{mode:b.mode,eventId:b.eventId,now});}
          catch(e){return json(res,e.status||400,{error:e.message});}
        }
        db.prepare('INSERT INTO location_preferences(user_id,gps_enabled,share_enabled,share_mode,share_expires_at,share_event_id,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET gps_enabled=excluded.gps_enabled,share_enabled=excluded.share_enabled,share_mode=excluded.share_mode,share_expires_at=excluded.share_expires_at,share_event_id=excluded.share_event_id,updated_at=excluded.updated_at')
          .run(user.id,Number(b.gpsEnabled),Number(b.shareEnabled),choice?.mode||'event',choice?.expiresAt||null,b.shareEnabled?b.eventId:null,now);
        if(!b.shareEnabled)db.prepare('DELETE FROM live_locations WHERE user_id=?').run(user.id);
        return json(res,200,{gpsEnabled:b.gpsEnabled,shareEnabled:b.shareEnabled,mode:choice?.mode||'event',eventId:b.shareEnabled?b.eventId:null,expiresAt:choice?.expiresAt||null});
      }
      if (url.pathname==='/api/location/me' && req.method==='GET') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const now=Date.now();expireLocationShares(db,now);
        const row=db.prepare('SELECT l.updated_at FROM live_locations l JOIN location_preferences p ON p.user_id=l.user_id WHERE l.user_id=? AND l.updated_at>? AND p.share_enabled=1 AND p.share_expires_at>?').get(user.id,now-LOCATION_FRESH_MS,now);
        return json(res,200,{sharing:!!row});
      }
      if (url.pathname==='/api/location/update' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);const lat=b.lat,lng=b.lng,accuracy=b.accuracy;
        if(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lng!=='number'||!Number.isFinite(lng)||Math.abs(lng)>180||typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return json(res,400,{error:'Coordenadas inválidas.'});
        const now=Date.now();
        const pref=db.prepare('SELECT share_enabled,share_expires_at,share_event_id FROM location_preferences WHERE user_id=?').get(user.id);
        if(!pref?.share_enabled)return json(res,403,{error:'Ative o compartilhamento de localização nesta conta antes de enviar o GPS.'});
        if(!pref.share_event_id)return json(res,403,{error:'Escolha um evento e reative o compartilhamento.'});
        if(typeof b.eventId!=='string'||b.eventId!==pref.share_event_id)return json(res,409,{error:'Sua localização está vinculada a outra festa. Ative novamente no evento correto.'});
        if(!pref.share_expires_at||pref.share_expires_at<=now){
          expireLocationShares(db,now);
          return json(res,410,{error:'O prazo de compartilhamento terminou. Ative novamente para continuar.'});
        }
        db.prepare('INSERT INTO live_locations(user_id,lat,lng,accuracy,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,updated_at=excluded.updated_at').run(user.id,lat,lng,accuracy,now);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/location/stop' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        db.prepare('DELETE FROM live_locations WHERE user_id=?').run(user.id);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/location/friends' && req.method==='GET') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const eventId=String(url.searchParams.get('event_id')||'');
        if(!eventId||eventId.length>100||!db.prepare('SELECT 1 FROM events WHERE id=?').get(eventId))return json(res,400,{error:'Informe um evento válido para visualizar posições.'});
        const now=Date.now();expireLocationShares(db,now);
        const rows=db.prepare('SELECT u.id,u.name,l.lat,l.lng,l.accuracy,l.updated_at AS updatedAt FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END JOIN live_locations l ON l.user_id=u.id JOIN location_preferences p ON p.user_id=u.id WHERE (f.user_a=? OR f.user_b=?) AND l.updated_at>? AND p.share_enabled=1 AND p.share_expires_at>? AND p.share_event_id=? ORDER BY u.name').all(user.id,user.id,user.id,now-LOCATION_FRESH_MS,now,eventId);
        return json(res,200,{friends:rows});
      }
      // O evento selecionado pelo usuário autenticado fica registrado no servidor.
      // Esse registro não comprova presença física, compra de ingresso ou autorização push.
      if(url.pathname==='/api/admin/notifications'&&req.method==='GET'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        return json(res,200,{items:db.prepare("SELECT n.*,e.name AS event_name,(SELECT COUNT(*) FROM notification_receipts r WHERE r.notification_id=n.id) AS recipients,(SELECT COUNT(*) FROM notification_push_queue q WHERE q.notification_id=n.id AND q.status='accepted') AS push_accepted,(SELECT COUNT(*) FROM notification_push_queue q WHERE q.notification_id=n.id AND q.status IN ('pending','processing')) AS push_pending,(SELECT COUNT(*) FROM notification_push_queue q WHERE q.notification_id=n.id AND q.status='failed') AS push_failed,(SELECT COUNT(*) FROM notification_push_queue q WHERE q.notification_id=n.id AND q.status='expired') AS push_expired FROM notifications n LEFT JOIN events e ON e.id=n.event_id ORDER BY n.created_at DESC LIMIT 300").all()});
      }
      if(url.pathname==='/api/admin/reviews'&&req.method==='GET'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        const eventId=String(url.searchParams.get('event_id')||'');
        const items=eventId?db.prepare('SELECT r.*,e.name AS event_name FROM event_reviews r JOIN events e ON e.id=r.event_id WHERE r.event_id=? ORDER BY r.updated_at DESC').all(eventId):db.prepare('SELECT r.*,e.name AS event_name FROM event_reviews r JOIN events e ON e.id=r.event_id ORDER BY r.updated_at DESC LIMIT 500').all();
        return json(res,200,{items:items.map(x=>({...x,tags:JSON.parse(x.tags_json||'[]'),tags_json:undefined}))});
      }
      if(url.pathname==='/api/admin/notifications/save'&&req.method==='POST'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        const b=await body(req),id=String(b.id||''),eventId=String(b.eventId||''),title=String(b.title||'').trim(),message=String(b.message||'').trim();
        const kind=String(b.kind||'info'),targetKind=String(b.targetKind||'event'),targetId=String(b.targetId||'');
        const audience=String(b.audience||'event'),schedule=Number(b.scheduledAt)||null,dispatch=String(b.action||'draft');
        if(!title||title.length>120||!message||message.length>700||!['promo','info','lineup','survey'].includes(kind)||!['event','map','point','menu','lineup','survey'].includes(targetKind)||!['event','all'].includes(audience)||!['draft','send','schedule','test'].includes(dispatch))return json(res,400,{error:'Dados da notificação inválidos.'});
        if(audience==='event'&&!db.prepare('SELECT 1 FROM events WHERE id=?').get(eventId))return json(res,400,{error:'Selecione um evento.'});
        if(targetKind==='point'){
          const rows=db.prepare('SELECT mm.markers_json FROM event_maps em JOIN map_markers mm ON mm.map_id=em.map_id WHERE em.event_id=?').all(eventId);
          if(!targetId||!rows.some(x=>{try{return JSON.parse(x.markers_json).some(m=>m.id===targetId);}catch{return false;}}))return json(res,400,{error:'Ponto não está cadastrado nos mapas do evento.'});
        }
        if(dispatch==='schedule'&&(!schedule||schedule<=Date.now()))return json(res,400,{error:'Informe um agendamento futuro.'});
        if(dispatch==='test'){
          const testId=randomUUID(),now=Date.now();
          notificationTransaction(db,()=>{
           db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(testId,eventId||null,title,message,kind,targetKind,targetId,'test','sent',null,u.id,now,now);
           addNotificationReceipt(db,testId,u.id,now);
          });
          void drainPushQueue();
          return json(res,200,{ok:true,test:true});
        }

        if(id){
          const old=db.prepare('SELECT status,created_by FROM notifications WHERE id=?').get(id);
          if(!old||old.status!=='draft')return json(res,409,{error:'A notificação já foi enviada ou não existe.'});
          db.prepare('UPDATE notifications SET event_id=?,title=?,body=?,kind=?,target_kind=?,target_id=?,audience=?,status=?,scheduled_at=? WHERE id=?').run(eventId||null,title,message,kind,targetKind,targetId,audience,dispatch==='schedule'?'scheduled':dispatch==='send'?'pending':'draft',dispatch==='schedule'?schedule:null,id);
        }else db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),eventId||null,title,message,kind,targetKind,targetId,audience,dispatch==='schedule'?'scheduled':dispatch==='send'?'pending':'draft',dispatch==='schedule'?schedule:null,u.id,Date.now());
        if(dispatch==='send'){dispatchDueNotifications();void drainPushQueue();}
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/admin/notifications/dispatch'&&req.method==='POST'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        const b=await body(req),id=String(b.id||''),action=String(b.action||''),schedule=Number(b.scheduledAt)||null;
        if(!['send','schedule','test'].includes(action))return json(res,400,{error:'Ação inválida.'});
        const source=db.prepare("SELECT * FROM notifications WHERE id=? AND status='draft'").get(id);
        if(!source)return json(res,404,{error:'Modelo salvo não encontrado.'});
        if(action==='schedule'&&(!schedule||schedule<=Date.now()))return json(res,400,{error:'Informe uma data futura.'});
        const now=Date.now(),sendId=randomUUID(),status=action==='test'?'sent':action==='schedule'?'scheduled':'pending';
        db.prepare('INSERT INTO notifications(id,event_id,title,body,kind,target_kind,target_id,audience,status,scheduled_at,created_by,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sendId,source.event_id,source.title,source.body,source.kind,source.target_kind,source.target_id,action==='test'?'test':source.audience,status,action==='schedule'?schedule:null,u.id,now,action==='test'?now:null);
        if(action==='test'){notificationTransaction(db,()=>addNotificationReceipt(db,sendId,u.id,now));void drainPushQueue();}
        else if(action==='send'){dispatchDueNotifications();void drainPushQueue();}
        return json(res,200,{ok:true,id:sendId});
      }
      if(url.pathname==='/api/admin/notifications/schedule'&&req.method==='POST'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        const b=await body(req),id=String(b.id||''),action=String(b.action||''),when=Number(b.scheduledAt)||null;
        if(!['cancel','reschedule'].includes(action))return json(res,400,{error:'Ação inválida.'});
        if(action==='reschedule'&&(!when||!Number.isSafeInteger(when)||when<=Date.now()))return json(res,400,{error:'Informe data e horário futuros.'});
        const result=action==='cancel'
          ?db.prepare("UPDATE notifications SET status='cancelled',scheduled_at=NULL WHERE id=? AND status='scheduled' AND created_by<>'system'").run(id)
          :db.prepare("UPDATE notifications SET scheduled_at=? WHERE id=? AND status='scheduled' AND created_by<>'system'").run(when,id);
        if(!result.changes)return json(res,409,{error:'Agendamento não encontrado ou já processado. Atualize a listagem.'});
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/admin/notifications/cancel'&&req.method==='POST'){
        const u=getUser(req);if(!isAdmin(u))return json(res,403,{error:'Acesso restrito.'});
        const b=await body(req);
        db.prepare("UPDATE notifications SET status='cancelled' WHERE id=? AND status IN ('draft','scheduled')").run(String(b.id||''));
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/events/participation'&&req.method==='POST'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login para vincular este evento.'});
        const b=await body(req),id=String(b.eventId||'');
        if(!id||!db.prepare('SELECT 1 FROM events WHERE id=? AND is_published=1').get(id))return json(res,404,{error:'Evento indisponível.'});
        const now=Date.now();
        db.prepare('INSERT INTO event_participants(event_id,user_id,first_selected_at,last_selected_at) VALUES(?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET last_selected_at=excluded.last_selected_at').run(id,user.id,now,now);
        return json(res,200,{ok:true,eventId:id});
      }
      if(url.pathname==='/api/events/participation'&&req.method==='GET'){
        const user=getUser(req);if(!user)return json(res,200,{items:[]});
        return json(res,200,{items:db.prepare('SELECT ep.event_id AS eventId,e.name AS eventName,ep.first_selected_at AS firstSelectedAt,ep.last_selected_at AS lastSelectedAt FROM event_participants ep JOIN events e ON e.id=ep.event_id WHERE ep.user_id=? ORDER BY ep.last_selected_at DESC').all(user.id)});
      }
      if(url.pathname==='/api/push/config'&&req.method==='GET')return json(res,200,{enabled:!!(VAPID_PUBLIC&&VAPID_PRIVATE),publicKey:VAPID_PUBLIC});
      if(url.pathname==='/api/push/subscribe'&&req.method==='POST'){
       const user=getUser(req);if(!user)return json(res,401,{error:'Faça login para receber notificações.'});
       if(!VAPID_PUBLIC||!VAPID_PRIVATE)return json(res,503,{error:'Push ainda não foi configurado no servidor.'});
       const b=await body(req),sub=b.subscription;
       if(!sub||typeof sub.endpoint!=='string'||!sub.endpoint.startsWith('https://')||!sub.keys?.p256dh||!sub.keys?.auth)return json(res,400,{error:'Assinatura inválida.'});
       if(JSON.stringify(sub).length>6000)return json(res,400,{error:'Assinatura inválida.'});
       db.prepare('INSERT INTO push_subscriptions(user_id,endpoint,subscription_json,created_at) VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,subscription_json=excluded.subscription_json').run(user.id,sub.endpoint,JSON.stringify(sub),Date.now());
       return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/push/unsubscribe'&&req.method==='POST'){
       const user=getUser(req);if(!user)return json(res,401,{error:'Faça login.'});
       const b=await body(req);db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').run(String(b.endpoint||''),user.id);return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/notifications'&&req.method==='GET'){
        const user=getUser(req);if(!user)return json(res,200,{items:[],unread:0});
        const items=db.prepare(`SELECT n.id,n.event_id AS eventId,n.title,n.body,n.kind,n.target_kind AS targetKind,n.target_id AS targetId,n.sent_at AS sentAt,r.read_at AS readAt FROM notification_receipts r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=? AND n.status='sent' ORDER BY n.sent_at DESC LIMIT 100`).all(user.id);
        return json(res,200,{items,unread:items.filter(x=>!x.readAt).length});
      }
      if(url.pathname==='/api/notifications/read'&&req.method==='POST'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login.'});
        const b=await body(req);
        db.prepare('UPDATE notification_receipts SET read_at=? WHERE notification_id=? AND user_id=? AND read_at IS NULL').run(Date.now(),String(b.id||''),user.id);
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/reviews'&&req.method==='GET'){
        const user=getUser(req);if(!user)return json(res,200,{items:[]});
        const items=db.prepare('SELECT r.event_id AS eventId,e.name AS eventName,r.rating,r.tags_json AS tagsJson,r.comment,r.updated_at AS updatedAt FROM event_reviews r JOIN events e ON e.id=r.event_id WHERE r.user_id=? ORDER BY r.updated_at DESC').all(user.id);
        return json(res,200,{items:items.map(x=>({...x,tags:JSON.parse(x.tagsJson),tagsJson:undefined}))});
      }
      if(url.pathname==='/api/reviews'&&req.method==='POST'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login.'});
        const b=await body(req),eventId=String(b.eventId||'');
        const event=db.prepare('SELECT ends_at FROM events WHERE id=? AND is_published=1').get(eventId);
        if(!event)return json(res,404,{error:'Evento não encontrado.'});
        const ends=eventEndMillis(event.ends_at);
        if(Number.isFinite(ends)&&Date.now()>ends+7*86400000)return json(res,409,{error:'O período de avaliação deste evento terminou.'});
        if(!db.prepare('SELECT 1 FROM event_participants WHERE event_id=? AND user_id=?').get(eventId,user.id))return json(res,403,{error:'Selecione o evento para poder avaliá-lo.'});
        const rating=Number(b.rating),tags=b.tags,comment=String(b.comment||'').trim();
        if(!Number.isInteger(rating)||rating<1||rating>5||!Array.isArray(tags)||tags.length>15||tags.some(x=>typeof x!=='string'||x.length>60)||comment.length>2000)return json(res,400,{error:'Avaliação inválida.'});
        const now=Date.now();
        db.prepare('INSERT INTO event_reviews(event_id,user_id,rating,tags_json,comment,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET rating=excluded.rating,tags_json=excluded.tags_json,comment=excluded.comment,updated_at=excluded.updated_at').run(eventId,user.id,rating,JSON.stringify(tags),comment,now,now);
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/public/menu'&&req.method==='GET'){const id=String(url.searchParams.get('event_id')||'');if(!db.prepare('SELECT 1 FROM events WHERE id=? AND is_published=1').get(id))return json(res,404,{error:'Evento não encontrado.'});return json(res,200,{items:db.prepare('SELECT p.*,ep.price_cents,COALESCE(ep.price_cents,p.default_price_cents) effective_price_cents FROM event_products ep JOIN products p ON p.id=ep.product_id WHERE ep.event_id=? ORDER BY p.category,p.name').all(id)});}
      if(url.pathname==='/api/public/branding'&&req.method==='GET')return json(res,200,{logo:db.prepare('SELECT logo_data,accent_color FROM app_branding WHERE id=1').get()?.logo_data||'',color:db.prepare('SELECT accent_color FROM app_branding WHERE id=1').get()?.accent_color||'#c4ff40'});
      if(url.pathname==='/api/public/event-settings'&&req.method==='GET'){
        return json(res,200,{settings:db.prepare('SELECT minimum_age,entry_rules,accepted_documents,cancellation_policy,contact_name,contact_phone FROM event_general_settings WHERE id=1').get()});
      }
      if(url.pathname==='/api/public/events'&&req.method==='GET'){
        const rows=db.prepare('SELECT e.*,v.name AS venue_name,v.address AS venue_address,v.city AS venue_city,v.services AS venue_services FROM events e JOIN venues v ON v.id=e.venue_id WHERE e.is_published=1 ORDER BY CASE WHEN e.ends_at>=? THEN 0 ELSE 1 END,e.starts_at').all(new Date().toISOString().slice(0,16));
        return json(res,200,{items:rows.map(e=>({id:e.id,name:e.name,description:e.description,starts_at:e.starts_at,ends_at:e.ends_at,site_url:e.site_url,tickets_url:e.tickets_url,instagram_url:e.instagram_url,doors_at:e.doors_at||'',cover_image:e.cover_image||'',services:e.services||'',venue:{id:e.venue_id,name:e.venue_name,address:e.venue_address,city:e.venue_city,services:e.venue_services||''},map_ids:db.prepare('SELECT map_id FROM event_maps WHERE event_id=?').all(e.id).map(m=>m.map_id),lineup:JSON.parse(e.lineup_json||'[]')||[]}))});
      }
      if(url.pathname==='/api/public/maps'&&req.method==='GET'){
        const rows=db.prepare('SELECT id,venue_id,name,frame_json FROM venue_maps').all();
        return json(res,200,{items:rows.map(m=>({...m,frame:frameOf(m),frame_json:undefined}))});
      }
      if(url.pathname==='/api/public/map-detail'&&req.method==='GET'){
        const id=String(url.searchParams.get('map_id')||'');
        const map=db.prepare('SELECT id,name,venue_id,frame_json FROM venue_maps WHERE id=?').get(id);
        if(!map)return json(res,404,{error:'Mapa não encontrado.'});
        const areas=db.prepare('SELECT id,name,kind,x,y,width,height,gps_json,description,color,icon FROM map_areas WHERE map_id=?').all(id).map(a=>({...a,gps:JSON.parse(a.gps_json||'{}'),gps_json:undefined}));
        const markers=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(id);
        return json(res,200,{map:{id:map.id,name:map.name,venue_id:map.venue_id,frame:frameOf(map)},areas,markers:JSON.parse(markers?.markers_json||'[]')});
      }
      if(url.pathname.startsWith('/api/admin/')){
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login.'});
        if(!isAdmin(user))return json(res,403,{error:'Acesso restrito a administradores.'});
        const key=url.pathname.slice('/api/admin/'.length);
        const tables={venues:'venues',maps:'venue_maps',areas:'map_areas',events:'events'};
        if(req.method==='GET'&&tables[key]){
          const rows=db.prepare('SELECT * FROM '+tables[key]).all();
          return json(res,200,{items:rows.map(row=>key==='events'?{...row,lineup:JSON.parse(row.lineup_json),map_ids:db.prepare('SELECT map_id FROM event_maps WHERE event_id=?').all(row.id).map(x=>x.map_id)}:key==='areas'?{...row,gps:JSON.parse(row.gps_json)}:key==='maps'?{...row,frame:frameOf(row),frame_json:undefined}:row)});
        }
        if(req.method==='GET'&&key==='search-venues'){
          const q=String(url.searchParams.get('q')||'').trim().slice(0,100);
          const text='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
          const items=db.prepare("SELECT * FROM venues WHERE ?='' OR name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR street LIKE ? ESCAPE '\\' OR neighborhood LIKE ? ESCAPE '\\' OR postal_code LIKE ? ESCAPE '\\' ORDER BY name COLLATE NOCASE LIMIT 200").all(q,text,text,text,text,text);
          return json(res,200,{items});
        }
        if(req.method==='GET'&&key==='products'){
          const q=String(url.searchParams.get('q')||'').trim().slice(0,120).toLowerCase(),category=String(url.searchParams.get('category')||'').trim().slice(0,60);
          const pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
          return json(res,200,{items:db.prepare("SELECT * FROM products WHERE (?='' OR lower(name) LIKE ? ESCAPE '\\' OR lower(description) LIKE ? ESCAPE '\\' OR lower(category) LIKE ? ESCAPE '\\') AND (?='' OR category=?) ORDER BY category,name").all(q,pattern,pattern,pattern,category,category)});
        }
        if(req.method==='GET'&&key==='event-products'){const id=String(url.searchParams.get('event_id')||'');return json(res,200,{items:db.prepare('SELECT product_id,price_cents FROM event_products WHERE event_id=?').all(id)});}
        if(req.method==='POST'&&key==='save-product'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim(),category=String(b.category||'').trim(),description=String(b.description||'').trim(),price=b.default_price_cents;
          if(!name||name.length>120||!category||category.length>60||description.length>500||!Number.isSafeInteger(price)||price<0||price>100000000)return json(res,400,{error:'Produto ou preço inválido.'});
          if(id){if(!db.prepare('SELECT 1 FROM products WHERE id=?').get(id))return json(res,404,{error:'Produto não encontrado.'});db.prepare('UPDATE products SET name=?,description=?,category=?,default_price_cents=? WHERE id=?').run(name,description,category,price,id);}
          else db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?)').run(randomUUID(),name,description,category,price,Date.now());
          return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='delete-product'){
          const id=String((await body(req)).id||'');db.exec('BEGIN');try{db.prepare('DELETE FROM event_products WHERE product_id=?').run(id);db.prepare('DELETE FROM products WHERE id=?').run(id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='save-event-products'){
          const b=await body(req),id=String(b.event_id||''),items=b.items;
          if(!db.prepare('SELECT 1 FROM events WHERE id=?').get(id)||!Array.isArray(items)||items.length>500)return json(res,400,{error:'Evento ou lista inválidos.'});
          const seen=new Set();for(const p of items){if(!p||typeof p.product_id!=='string'||seen.has(p.product_id)||!db.prepare('SELECT 1 FROM products WHERE id=?').get(p.product_id)||!(p.price_cents===null||(Number.isSafeInteger(p.price_cents)&&p.price_cents>=0&&p.price_cents<=100000000)))return json(res,400,{error:'Produto ou preço inválido.'});seen.add(p.product_id);}
          db.exec('BEGIN');try{db.prepare('DELETE FROM event_products WHERE event_id=?').run(id);for(const p of items)db.prepare('INSERT INTO event_products VALUES(?,?,?)').run(id,p.product_id,p.price_cents);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});
        }
        if(req.method==='GET'&&key==='branding')return json(res,200,{logo:db.prepare('SELECT logo_data FROM app_branding WHERE id=1').get()?.logo_data||'',color:db.prepare('SELECT accent_color FROM app_branding WHERE id=1').get()?.accent_color||'#c4ff40'});
        if(req.method==='POST'&&key==='accent-color'){
          const b=await body(req),color=String(b.color||'').trim().toLowerCase();
          if(!/^#[0-9a-f]{6}$/.test(color))return json(res,400,{error:'Escolha uma cor hexadecimal válida.'});
          db.prepare('UPDATE app_branding SET accent_color=? WHERE id=1').run(color);
          return json(res,200,{ok:true,color});
        }
        if(req.method==='POST'&&key==='branding'){
          const b=await body(req),logo=b.logo;
          if(typeof logo!=='string'||logo.length>120000||(logo&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(logo)))return json(res,400,{error:'Use uma imagem PNG, JPG ou WebP de até 90 KB.'});
          db.prepare('UPDATE app_branding SET logo_data=? WHERE id=1').run(logo);
          return json(res,200,{ok:true,logo});
        }
        if(req.method==='GET'&&key==='event-settings')return json(res,200,{settings:db.prepare('SELECT minimum_age,entry_rules,accepted_documents,cancellation_policy,contact_name,contact_phone FROM event_general_settings WHERE id=1').get()});
        if(req.method==='POST'&&key==='event-settings'){
          const b=await body(req),age=Number(b.minimum_age);
          if(!Number.isInteger(age)||age<0||age>100||['entry_rules','accepted_documents','cancellation_policy'].some(k=>typeof b[k]!=='string'||b[k].length>5000))return json(res,400,{error:'Preferências inválidas.'});
          const contactName=String(b.contact_name||'').trim(),contactPhone=String(b.contact_phone||'').replace(/\D/g,'');
          if(contactName.length>100||(contactPhone&&contactPhone.length!==11))return json(res,400,{error:'Informe um celular com DDD e 11 dígitos, ou deixe em branco.'});
          db.prepare('UPDATE event_general_settings SET minimum_age=?,entry_rules=?,accepted_documents=?,cancellation_policy=?,contact_name=?,contact_phone=? WHERE id=1').run(age,b.entry_rules,b.accepted_documents,b.cancellation_policy,contactName,contactPhone);
          return json(res,200,{ok:true});
        }
        if(req.method==='GET'&&key==='overview'){
          const cutoff=Date.now()-15*60*1000;
          return json(res,200,{totalUsers:db.prepare('SELECT COUNT(*) n FROM users').get().n,activeUsers:db.prepare('SELECT COUNT(*) n FROM user_activity WHERE last_seen>?').get(cutoff).n,sharingNow:db.prepare('SELECT COUNT(*) n FROM live_locations WHERE updated_at>?').get(Date.now()-90000).n,activeWindowMinutes:15});
        }
        if(req.method==='POST'&&key==='edit-venue'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100);
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(id))return json(res,400,{error:'Estabelecimento inválido.'});
          db.prepare('UPDATE venues SET name=?,address=?,city=?,postal_code=?,street=?,neighborhood=?,complement=?,address_url=?,services=? WHERE id=?').run(name,String(b.address||'').slice(0,300),String(b.city||'').slice(0,100),String(b.postal_code||'').slice(0,12),String(b.street||'').slice(0,200),String(b.neighborhood||'').slice(0,100),String(b.complement||'').slice(0,150),String(b.address_url||'').slice(0,500),String(b.services||'').slice(0,2000),id);return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='edit-map'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||'');
          if(!name||!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(id)||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId))return json(res,400,{error:'Mapa inválido.'});
          db.prepare('UPDATE venue_maps SET name=?,venue_id=? WHERE id=?').run(name,venueId,id);return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='save-layout'){
          const b=await body(req),mapId=String(b.map_id||''),areas=b.areas,markers=b.markers,frame=b.frame;
          if(!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(mapId))return json(res,404,{error:'Mapa não encontrado.'});
          if(frame!==undefined&&!isValidMapFrame(frame))return json(res,400,{error:'Dimensões da área do mapa inválidas.'});
          if(!Array.isArray(areas)||areas.length>150||!Array.isArray(markers)||markers.length>250)return json(res,400,{error:'Limite de ambientes ou pontos excedido.'});
          const ids=new Set();
          const validColor=c=>c===undefined||/^#[0-9a-fA-F]{6}$/.test(c);
          for(const a of areas){
            if(!a||typeof a.id!=='string'||a.id.length>100||!a.id||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>100||
              typeof a.kind!=='string'||a.kind.length>30||![a.x,a.y,a.width,a.height].every(n=>typeof n==='number'&&Number.isFinite(n))||
              a.x< -35.001||a.y< -35.001||a.width<3||a.height<3||a.x+a.width>135.001||a.y+a.height>135.001||
              !validColor(a.color)||typeof(a.description||'')!=='string'||String(a.description||'').length>500||
              typeof(a.icon||'')!=='string'||String(a.icon||'').length>40||!a.gps||typeof a.gps!=='object'||JSON.stringify(a.gps).length>3000
            )return json(res,400,{error:'Ambiente inválido: verifique nome, formato e limites do mapa.'});
            ids.add(a.id);
            const existing=db.prepare('SELECT map_id FROM map_areas WHERE id=?').get(a.id);
            if(existing&&existing.map_id!==mapId)return json(res,400,{error:'Ambiente pertence a outro mapa.'});
          }
          const markerIds=new Set();
          for(const m of markers){
            if(!m||typeof m.id!=='string'||!m.id||m.id.length>100||markerIds.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>100||
              typeof m.type!=='string'||m.type.length>40||![m.x,m.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=-35&&n<=135)||
              !['square','circle',undefined].includes(m.shape)||!(m.size===undefined||(Number.isFinite(m.size)&&m.size>=24&&m.size<=72))||
              !validColor(m.color)||typeof(m.description||'')!=='string'||String(m.description||'').length>500||
              ![m.opens_at,m.closes_at].every(t=>t===undefined||t===''||typeof t==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t))||
              (!!m.opens_at!==!!m.closes_at)||
              (m.categories!==undefined&&(!Array.isArray(m.categories)||m.categories.length>30||m.categories.some(c=>typeof c!=='string'||!c.trim()||c.length>80)))
            )return json(res,400,{error:'Ponto inválido: verifique nome, formato, tamanho e posição.'});
            if(m.type==='entrada'&&!m.anchor)return json(res,400,{error:'Entradas precisam estar ancoradas a uma borda do mapa.'});
            if(m.anchor!==undefined){
              const anchor=m.anchor;
              if(!anchor||!['top','right','bottom','left'].includes(anchor.side)||typeof anchor.offset!=='number'||!Number.isFinite(anchor.offset)||anchor.offset<0||anchor.offset>100||
                 (anchor.side==='top'&&(Math.abs(m.x-anchor.offset)>0.001||Math.abs(m.y)>0.001))||
                 (anchor.side==='bottom'&&(Math.abs(m.x-anchor.offset)>0.001||Math.abs(m.y-100)>0.001))||
                 (anchor.side==='left'&&(Math.abs(m.x)>0.001||Math.abs(m.y-anchor.offset)>0.001))||
                 (anchor.side==='right'&&(Math.abs(m.x-100)>0.001||Math.abs(m.y-anchor.offset)>0.001))
              )return json(res,400,{error:'Ponto ancorado fora da borda selecionada.'});
            }
            markerIds.add(m.id);
          }
          db.exec('BEGIN');
          try{
            db.prepare('DELETE FROM map_areas WHERE map_id=?').run(mapId);
            const insert=db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height,gps_json,description,color,icon) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
            for(const a of areas)insert.run(a.id,mapId,a.name.trim(),a.kind,a.x,a.y,a.width,a.height,JSON.stringify(a.gps),String(a.description||''),String(a.color||'#9747FF'),String(a.icon||''));
            db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?) ON CONFLICT(map_id) DO UPDATE SET markers_json=excluded.markers_json').run(mapId,JSON.stringify(markers));
            if(frame!==undefined)db.prepare('UPDATE venue_maps SET frame_json=? WHERE id=?').run(JSON.stringify(frame),mapId);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,200,{ok:true,areas:areas.length,markers:markers.length});
        }
        if(req.method==='POST'&&key==='edit-area'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100),nums=[b.x,b.y,b.width,b.height].map(Number);
          if(!name||!db.prepare('SELECT 1 FROM map_areas WHERE id=?').get(id)||nums.some(n=>!Number.isFinite(n))||nums[0]<0||nums[1]<0||nums[2]<=0||nums[3]<=0||nums[0]+nums[2]>100||nums[1]+nums[3]>100)return json(res,400,{error:'Dimensões inválidas.'});
          db.prepare('UPDATE map_areas SET name=?,kind=?,x=?,y=?,width=?,height=? WHERE id=?').run(name,String(b.kind||'principal').slice(0,30),...nums,id);return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='markers'){
          const b=await body(req),id=String(b.map_id||''),markers=b.markers;
          if(!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(id)||!Array.isArray(markers)||markers.length>250||markers.some(m=>typeof m.name!=='string'||m.name.length>100||typeof m.type!=='string'||m.type.length>40||![m.x,m.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100)))return json(res,400,{error:'Pontos inválidos.'});
          db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?) ON CONFLICT(map_id) DO UPDATE SET markers_json=excluded.markers_json').run(id,JSON.stringify(markers));return json(res,200,{ok:true});
        }
        if(req.method==='GET'&&key==='markers'){
          const id=url.searchParams.get('map_id')||'';
          if(!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(id))return json(res,404,{error:'Mapa não encontrado.'});
          const row=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(id);
          return json(res,200,{items:row?JSON.parse(row.markers_json):[]});
        }
        if(req.method==='POST'&&key==='venues'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100);
          if(!name)return json(res,400,{error:'Nome obrigatório.'});
          const id=randomUUID();db.prepare('INSERT INTO venues(id,name,address,city,created_at,postal_code,street,neighborhood,complement,address_url,services) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,name,String(b.address||''),String(b.city||''),Date.now(),String(b.postal_code||'').slice(0,12),String(b.street||'').slice(0,200),String(b.neighborhood||'').slice(0,100),String(b.complement||'').slice(0,150),String(b.address_url||'').slice(0,500),String(b.services||'').slice(0,2000));return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='maps'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),venue=String(b.venue_id||'');
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venue))return json(res,400,{error:'Estabelecimento e nome obrigatórios.'});
          const id=randomUUID();
          db.exec('BEGIN');
          try{
            db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)').run(id,venue,name,Date.now());
            insertDefaultMapAreas(db,id,randomUUID);
            db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?)').run(id,JSON.stringify(DEMO_MARKERS.map(marker=>({...marker,id:randomUUID()}))));
            db.exec('COMMIT');
          }catch(error){db.exec('ROLLBACK');throw error;}
          return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='areas'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),mapId=String(b.map_id||''),nums=[b.x,b.y,b.width,b.height].map(Number);
          if(!name||!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(mapId)||nums.some(x=>!Number.isFinite(x))||nums[0]<0||nums[1]<0||nums[2]<=0||nums[3]<=0||nums[0]+nums[2]>100||nums[1]+nums[3]>100)return json(res,400,{error:'Nome, mapa ou dimensões inválidos.'});
          const id=randomUUID();db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height) VALUES(?,?,?,?,?,?,?,?)').run(id,mapId,name,String(b.kind||'principal'),...nums);return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='gps'){
          const b=await body(req),area=db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get(String(b.id||'')),corner=String(b.corner||''),lat=Number(b.lat),lng=Number(b.lng),accuracy=Number(b.accuracy);
          if(!area||!['tl','tr','br','bl'].includes(corner)||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180||!Number.isFinite(accuracy)||accuracy<0)return json(res,400,{error:'GPS inválido.'});
          const previous=JSON.parse(area.gps_json||'{}');
          const gps=previous.mode==='demo-auto'?{}:{...previous};
          gps[corner]={lat,lng,accuracy};gps.mode='manual';
          delete gps.spacingMeters;delete gps.widthMeters;delete gps.heightMeters;delete gps.accuracyMeters;delete gps.generatedAt;
          db.prepare('UPDATE map_areas SET gps_json=? WHERE id=?').run(JSON.stringify(gps),b.id);return json(res,200,{gps});
        }
        if(req.method==='POST'&&key==='set-event-publication'){
          const b=await body(req),id=String(b.id||''),publish=b.published===true;
          const event=db.prepare('SELECT e.*,v.id AS valid_venue FROM events e LEFT JOIN venues v ON v.id=e.venue_id WHERE e.id=?').get(id);
          if(!event)return json(res,404,{error:'Evento não encontrado.'});
          if(publish){
            if(!event.name.trim()||!event.valid_venue||!event.starts_at||!event.ends_at||!Number.isFinite(Date.parse(event.starts_at))||!Number.isFinite(eventEndMillis(event.ends_at))||eventEndMillis(event.ends_at)<=Date.parse(event.starts_at))return json(res,400,{error:'Defina nome, estabelecimento e datas válidas de início e término antes de publicar.'});
            if(!db.prepare('SELECT 1 FROM event_maps em JOIN venue_maps m ON m.id=em.map_id WHERE em.event_id=? AND m.venue_id=?').get(id,event.venue_id))return json(res,400,{error:'Selecione ao menos um mapa do estabelecimento para publicar.'});
          }
          db.prepare('UPDATE events SET is_published=? WHERE id=?').run(publish?1:0,id);
          return json(res,200,{ok:true,is_published:publish?1:0});
        }
        const validDjSocial=(d)=>['instagram','spotify'].every(k=>{const value=d?.[k];if(!value)return true;if(typeof value!=='string')return false;try{const url=new URL(value);return url.protocol==='https:'&&(k==='instagram'?['www.instagram.com','instagram.com'].includes(url.hostname):url.hostname==='open.spotify.com')&&url.pathname!=='/';}catch{return false;}});
        if(req.method==='POST'&&key==='events'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||''),ids=[...new Set(Array.isArray(b.map_ids)?b.map_ids:[])];
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId)||ids.some(id=>!db.prepare('SELECT 1 FROM venue_maps WHERE id=? AND venue_id=?').get(id,venueId)))return json(res,400,{error:'Nome, estabelecimento ou mapas inválidos. Todos os mapas devem pertencer ao mesmo estabelecimento.'});
          if(Array.isArray(b.lineup)&&b.lineup.some(d=>!validDjSocial(d)))return json(res,400,{error:'Use URLs HTTPS completas do Instagram e Spotify no lineup.'});
          const id=randomUUID();db.exec('BEGIN');
          try{
            db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,venueId,name,String(b.description||''),String(b.starts_at||''),String(b.ends_at||''),String(b.site_url||''),String(b.tickets_url||''),String(b.instagram_url||''),JSON.stringify(Array.isArray(b.lineup)?b.lineup:[]),Date.now());
            db.prepare('UPDATE events SET doors_at=?,cover_image=?,services=? WHERE id=?').run(String(b.doors_at||'').slice(0,20),String(b.cover_image||'').slice(0,160000),String(b.services||'').slice(0,2000),id);
            db.prepare('UPDATE events SET meaple_event_id=? WHERE id=?').run(String(b.meaple_event_id||'').trim().slice(0,120),id);
            for(const mapId of ids)db.prepare('INSERT INTO event_maps VALUES(?,?)').run(id,mapId);
             db.prepare('UPDATE events SET is_published=0 WHERE id=?').run(id);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='seed-demo'){
          const request=await body(req);
          let location;
          try{location=validateDemoLocation(request.location);}catch(error){return json(res,400,{error:error.message});}
          const result=ensureDemoData(db,{location});
          const showcase=ensureDemoShowcase(db,{baseEventId:result.id});
          const notifications=ensureDemoNotifications(db,{eventId:result.id});
          return json(res,result.created||showcase.created||notifications.created?201:200,{...result,showcase,notifications});
        }
        if(req.method==='POST'&&key==='delete'){
          const b=await body(req),id=String(b.id||''),entity=String(b.entity||'');
          const table={venue:'venues',map:'venue_maps',area:'map_areas',event:'events'}[entity];
          if(!table)return json(res,400,{error:'Entidade inválida.'});
          if(!db.prepare('SELECT 1 FROM '+table+' WHERE id=?').get(id))return json(res,404,{error:'Registro não encontrado.'});
          if(entity==='venue'&&(db.prepare('SELECT 1 FROM venue_maps WHERE venue_id=?').get(id)||db.prepare('SELECT 1 FROM events WHERE venue_id=?').get(id)))return json(res,409,{error:'Exclua os mapas e eventos vinculados primeiro.'});
          if(entity==='map'&&db.prepare('SELECT 1 FROM event_maps WHERE map_id=?').get(id))return json(res,409,{error:'Remova o mapa dos eventos primeiro.'});
          db.exec('BEGIN');try{
            if(entity==='event'){db.prepare('UPDATE events SET doors_at=?,cover_image=?,services=? WHERE id=?').run(String(b.doors_at||'').slice(0,20),String(b.cover_image||'').slice(0,160000),String(b.services||'').slice(0,2000),id);
            db.prepare('DELETE FROM event_maps WHERE event_id=?').run(id);db.prepare('DELETE FROM event_products WHERE event_id=?').run(id);}
            if(entity==='map'){db.prepare('DELETE FROM map_areas WHERE map_id=?').run(id);db.prepare('DELETE FROM map_markers WHERE map_id=?').run(id);}
            db.prepare('DELETE FROM '+table+' WHERE id=?').run(id);db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='edit-event'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||''),ids=[...new Set(Array.isArray(b.map_ids)?b.map_ids:[])];
          if(!db.prepare('SELECT 1 FROM events WHERE id=?').get(id))return json(res,404,{error:'Evento não encontrado.'});
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId)||ids.some(mid=>!db.prepare('SELECT 1 FROM venue_maps WHERE id=? AND venue_id=?').get(mid,venueId)))return json(res,400,{error:'Nome, estabelecimento ou mapas inválidos.'});
          if(db.prepare('SELECT is_published FROM events WHERE id=?').get(id).is_published && (!ids.length||!b.starts_at||!b.ends_at||!Number.isFinite(Date.parse(b.starts_at))||!Number.isFinite(Date.parse(b.ends_at))||Date.parse(b.ends_at)<=Date.parse(b.starts_at)))return json(res,400,{error:'Despublique o evento antes de remover mapas ou datas obrigatórias.'});
           if(!Array.isArray(b.lineup)||b.lineup.length>100||b.lineup.some(d=>!d||typeof d.nome!=='string'||d.nome.length>120||!validDjSocial(d)))return json(res,400,{error:'Lineup inválido.'});
          db.exec('BEGIN');try{
            db.prepare('UPDATE events SET name=?,venue_id=?,description=?,starts_at=?,ends_at=?,site_url=?,tickets_url=?,instagram_url=?,lineup_json=? WHERE id=?').run(name,venueId,String(b.description||'').slice(0,2000),String(b.starts_at||''),String(b.ends_at||''),String(b.site_url||''),String(b.tickets_url||''),String(b.instagram_url||''),JSON.stringify(b.lineup),id);
            db.prepare('UPDATE events SET meaple_event_id=? WHERE id=?').run(String(b.meaple_event_id||'').trim().slice(0,120),id);
            db.prepare('DELETE FROM event_maps WHERE event_id=?').run(id);
            for(const mid of ids)db.prepare('INSERT INTO event_maps VALUES(?,?)').run(id,mid);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,200,{ok:true});
        }
        return json(res,404,{error:'Operação administrativa não encontrada.'});
      }
      if (url.pathname==='/api/auth/me' && req.method==='GET') {
        const token=cookie(req,JWT_COOKIE_NAME);
        const claims=verifyJwt(token,JWT_SECRET);
        const user=getUser(req);
        let authStatus='authenticated';
        if(!user){
          if(!token)authStatus='cookie_missing';
          else if(!claims)authStatus='token_invalid';
          else {
            const row=db.prepare('SELECT token_version FROM users WHERE id=?').get(claims.sub);
            authStatus=!row?'user_missing':row.token_version!==claims.ver?'token_revoked':'unknown';
          }
        }
        return json(res,200,{user:user?{...user,isAdmin:isAdmin(user)}:null,authStatus});
      }
      if (url.pathname==='/api/auth/demo-admin' && req.method==='POST') {
        if(process.env.ENABLE_DEMO_USERS!=='true' || process.env.ENABLE_DEMO_ADMIN!=='true')return json(res,403,{error:'Criação de administrador de teste desativada. Configure ENABLE_DEMO_USERS e ENABLE_DEMO_ADMIN.'});
        const id=randomUUID(),suffix=randomBytes(6).toString('hex');
        const name='Admin Teste '+suffix.slice(0,6).toUpperCase();
        const email='admin-teste-'+suffix+'@example.invalid';
        const password=randomBytes(24).toString('base64url');
        db.exec('BEGIN');
        try{
          db.prepare('INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)').run(id,name,email,passwordHash(password),Date.now());
          db.prepare('INSERT INTO admin_users VALUES(?,?)').run(id,Date.now());
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
        createSession(req,res,id);
        return json(res,201,{user:{id,name,email,isAdmin:true},password});
      }
      if (url.pathname==='/api/auth/demo' && req.method==='POST') {
        if(process.env.ENABLE_DEMO_USERS!=='true') return json(res,403,{error:'Contas de teste desativadas neste ambiente.'});
        const id=randomUUID();const suffix=randomBytes(5).toString('hex');
        const name='Teste '+suffix.slice(0,6).toUpperCase();
        const email='teste-'+suffix+'@example.invalid';
        const password=randomBytes(24).toString('base64url');
        db.prepare('INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)').run(id,name,email,passwordHash(password),Date.now());
        createSession(req,res,id);
        return json(res,201,{user:{id,name,email},password});
      }
      if(url.pathname==='/api/auth/profile'&&req.method==='POST'){
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req),name=String(b.name||'').trim().slice(0,60),phone=String(b.phone||'').replace(/[^0-9]/g,''),instagram=String(b.instagram||'').trim().replace(/^@/,'').slice(0,30);
        if(name.length<2||phone.length!==0&&(phone.length!==11)||instagram&&!/^[a-zA-Z0-9._]+$/.test(instagram))return json(res,400,{error:'Nome, celular ou Instagram inválido.'});
        const avatar=b.avatar===undefined?null:String(b.avatar||'');
        if(avatar!==null&&avatar!==''&&(!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar)||avatar.length>180000))return json(res,400,{error:'Imagem de perfil inválida ou muito grande (máximo ~130 KB).'});
        if(avatar===null)db.prepare('UPDATE users SET name=?,phone=?,instagram=? WHERE id=?').run(name,phone,instagram,user.id);
        else db.prepare('UPDATE users SET name=?,phone=?,instagram=?,avatar_data=? WHERE id=?').run(name,phone,instagram,avatar,user.id);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/auth/register' && req.method==='POST') {
        const b=await body(req),email=String(b.email||'').trim().toLowerCase(),pass=String(b.password||''),name=String(b.name||'').trim().slice(0,60)||(email.split('@')[0].length>=2?email.split('@')[0].slice(0,60):'Participante'),phone=String(b.phone||'').replace(/[^0-9]/g,'');
        if(name.length<2 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length>254 || pass.length<10 || pass.length>128||phone.length!==0&&(phone.length!==11)) return json(res,400,{error:'Informe e-mail válido, senha de 10 a 128 caracteres e, se quiser, um celular válido.'});
        if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return json(res,409,{error:'E-mail já cadastrado.'});
        const id=randomUUID();db.prepare('INSERT INTO users(id,name,email,password,phone,created_at) VALUES(?,?,?,?,?,?)').run(id,name,email,passwordHash(pass),phone,Date.now());createSession(req,res,id);return json(res,201,{user:{id,name,email}});
      }
      if (url.pathname==='/api/auth/login' && req.method==='POST') {
        const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const pass=String(b.password||'');
        const key=loginKey(req,email);if(loginLimit.hit(key))return json(res,429,{error:'Muitas tentativas de login. Aguarde dez minutos.'});
        const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if(!user || !validPassword(pass,user.password)) return json(res,401,{error:'E-mail ou senha incorretos.'});
        loginLimit.clear(key);createSession(req,res,user.id);return json(res,200,{user:{id:user.id,name:user.name,email:user.email}});
      }
      if (url.pathname==='/api/auth/logout' && req.method==='POST') { const user=getUser(req);if(user){db.prepare('DELETE FROM live_locations WHERE user_id=?').run(user.id);db.prepare('UPDATE location_preferences SET share_enabled=0,gps_enabled=0,share_expires_at=NULL,share_event_id=NULL,updated_at=? WHERE user_id=?').run(Date.now(),user.id);db.prepare('UPDATE users SET token_version=token_version+1 WHERE id=?').run(user.id);}res.setHeader('Set-Cookie',sessionCookie('',0,req));return json(res,200,{ok:true}); }
      if (url.pathname==='/api/auth/password' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login primeiro.'});
        const b=await body(req);const stored=db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
        if(!validPassword(String(b.current||''),stored.password))return json(res,400,{error:'Senha atual incorreta.'});
        const pass=String(b.password||'');if(pass.length<10 || pass.length>128)return json(res,400,{error:'A nova senha precisa ter entre 10 e 128 caracteres.'});
        db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(pass),user.id);
        db.prepare('UPDATE users SET token_version=token_version+1 WHERE id=?').run(user.id);createSession(req,res,user.id);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/auth/forgot' && req.method==='POST') {
        if(!process.env.RESEND_API_KEY || !process.env.RESET_FROM_EMAIL) return json(res,503,{error:'Recuperação por e-mail ainda não configurada pelo administrador.'});
        const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const user=db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
        if(user) {const token=randomBytes(32).toString('hex');const tokenHash=hashToken(token);db.prepare('INSERT INTO resets VALUES(?,?,?)').run(tokenHash,user.id,Date.now()+1800000);
          const link=`${PUBLIC_APP_ORIGIN}/reset-password?reset=${encodeURIComponent(token)}`;
          try { await sendReset(user.email,link); } catch(e) {db.prepare('DELETE FROM resets WHERE token_hash=?').run(tokenHash);console.error('Reset email delivery failed',e);return json(res,502,{error:'Não foi possível enviar o e-mail agora.'});}
        }
        return json(res,200,{ok:true,message:'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'});
      }
      if (url.pathname==='/api/auth/reset' && req.method==='POST') {
        const b=await body(req);const token=String(b.token||''),pass=String(b.password||'');
        if(!/^[a-f0-9]{64}$/.test(token) || pass.length<10 || pass.length>128)return json(res,400,{error:'Link inválido ou senha fora dos requisitos.'});
        const row=db.prepare('SELECT user_id FROM resets WHERE token_hash=? AND expires_at>?').get(hashToken(token),Date.now());
        if(!row)return json(res,400,{error:'Link inválido ou expirado.'});
        db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(pass),row.user_id);
        db.prepare('DELETE FROM resets WHERE user_id=?').run(row.user_id);
        db.prepare('UPDATE users SET token_version=token_version+1 WHERE id=?').run(row.user_id);
        return json(res,200,{ok:true});
      }
      return json(res,404,{error:'Rota não encontrada'});
    }
    if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);return res.end();}
    let file=path.resolve(PUBLIC,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(PUBLIC+path.sep) && file!==PUBLIC){res.writeHead(403);return res.end();}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(PUBLIC,'index.html');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});
    if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
  } catch(e) {console.error('Request failed:',e);json(res,400,{error:'Não foi possível concluir a operação.'});}
}).listen(PORT,'0.0.0.0',()=>console.log('Submundo808 listening on',PORT));
