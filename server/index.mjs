import http from 'node:http';
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
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friend_codes (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships (user_a TEXT NOT NULL, user_b TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_a,user_b));
CREATE TABLE IF NOT EXISTS friend_invites (user_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS live_locations (user_id TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL NOT NULL, updated_at INTEGER NOT NULL);`);
db.exec('CREATE TABLE IF NOT EXISTS admin_users(user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
db.exec(`CREATE TABLE IF NOT EXISTS venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,gps_json TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));`);
db.exec("CREATE TABLE IF NOT EXISTS map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL DEFAULT '[]')");
db.exec('CREATE TABLE IF NOT EXISTS user_activity(user_id TEXT PRIMARY KEY,last_seen INTEGER NOT NULL)');
const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
if(adminEmail){const row=db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail);if(row)db.prepare('INSERT OR IGNORE INTO admin_users VALUES(?,?)').run(row.id,Date.now());}
const isAdmin=user=>!!user&&!!db.prepare('SELECT 1 FROM admin_users WHERE user_id=?').get(user.id);
const json = (res, status, body, headers={}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const hashToken = value => createHash('sha256').update(value).digest('hex');
const passwordHash = pass => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(pass, salt, 64).toString('hex'); };
const validPassword = (pass, stored) => { const [salt, expected] = stored.split(':'); if (!salt || !expected) return false; const actual = scryptSync(pass, salt, 64); const wanted = Buffer.from(expected, 'hex'); return actual.length === wanted.length && timingSafeEqual(actual, wanted); };
const cookie = (req, key) => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(key + '='))?.slice(key.length + 1);
const getUser = req => { const token = cookie(req, 'sid'); if (!token) return null; const user=db.prepare('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token), Date.now()) || null; if(user){db.prepare('INSERT INTO user_activity(user_id,last_seen) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').run(user.id,Date.now());}return user; };
const sessionCookie = (token, maxAge=604800) => `sid=${token}; HttpOnly; Secure; SameSite=Lax; Domain=.submundo.menudevendas.com.br; Path=/; Max-Age=${maxAge}`;
const createSession = (res, id) => { const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token), id, Date.now()+604800000); res.setHeader('Set-Cookie', sessionCookie(token)); };
const attempts = new Map();
function limited(req) { const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0]; const now = Date.now(); const item = attempts.get(ip) || { count:0, reset:now+60000 }; if (now > item.reset) { item.count=0; item.reset=now+60000; } item.count++; attempts.set(ip,item); if (attempts.size>5000) attempts.clear(); return item.count>20; }
async function body(req) { let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>12000) throw Error('Payload muito grande'); } return JSON.parse(raw || '{}'); }
async function sendReset(email, link) {
  if (!process.env.RESEND_API_KEY || !process.env.RESET_FROM_EMAIL) return false;
  const result = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'}, body:JSON.stringify({from:process.env.RESET_FROM_EMAIL,to:[email],subject:'Redefinir senha — Submundo 808',text:'Para redefinir sua senha, abra este link (válido por 30 minutos): '+link}) });
  if (!result.ok) throw Error('Falha no serviço de e-mail');
  return true;
}
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
http.createServer(async (req,res)=>{
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST') {
        const origin=req.headers.origin;
        const host=req.headers['x-forwarded-host'] || req.headers.host;
        if (origin && new URL(origin).host !== host) return json(res,403,{error:'Origem inválida'});
        if (limited(req)) return json(res,429,{error:'Muitas tentativas. Aguarde um minuto.'});
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
      if (url.pathname==='/api/location/me' && req.method==='GET') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const row=db.prepare('SELECT updated_at FROM live_locations WHERE user_id=? AND updated_at>?').get(user.id,Date.now()-90000);
        return json(res,200,{sharing:!!row});
      }
      if (url.pathname==='/api/location/update' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);const lat=b.lat,lng=b.lng,accuracy=b.accuracy;
        if(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lng!=='number'||!Number.isFinite(lng)||Math.abs(lng)>180||typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000)return json(res,400,{error:'Coordenadas inválidas.'});
        db.prepare('INSERT INTO live_locations(user_id,lat,lng,accuracy,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,updated_at=excluded.updated_at').run(user.id,lat,lng,accuracy,Date.now());
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/location/stop' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        db.prepare('DELETE FROM live_locations WHERE user_id=?').run(user.id);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/location/friends' && req.method==='GET') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        db.prepare('DELETE FROM live_locations WHERE updated_at<?').run(Date.now()-90000);
        const rows=db.prepare('SELECT u.id,u.name,l.lat,l.lng,l.accuracy,l.updated_at AS updatedAt FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END JOIN live_locations l ON l.user_id=u.id WHERE (f.user_a=? OR f.user_b=?) AND l.updated_at>? ORDER BY u.name').all(user.id,user.id,user.id,Date.now()-90000);
        return json(res,200,{friends:rows});
      }
      if(url.pathname==='/api/public/events'&&req.method==='GET'){
        const rows=db.prepare('SELECT e.*,v.name AS venue_name,v.address AS venue_address,v.city AS venue_city FROM events e JOIN venues v ON v.id=e.venue_id ORDER BY CASE WHEN e.ends_at>=? THEN 0 ELSE 1 END,e.starts_at').all(new Date().toISOString().slice(0,16));
        return json(res,200,{items:rows.map(e=>({id:e.id,name:e.name,description:e.description,starts_at:e.starts_at,ends_at:e.ends_at,site_url:e.site_url,tickets_url:e.tickets_url,instagram_url:e.instagram_url,venue:{id:e.venue_id,name:e.venue_name,address:e.venue_address,city:e.venue_city},map_ids:db.prepare('SELECT map_id FROM event_maps WHERE event_id=?').all(e.id).map(m=>m.map_id),lineup:JSON.parse(e.lineup_json||'[]')||[]}))});
      }
      if(url.pathname==='/api/public/maps'&&req.method==='GET'){
        const rows=db.prepare('SELECT id,venue_id,name FROM venue_maps').all();
        return json(res,200,{items:rows});
      }
      if(url.pathname==='/api/public/map-detail'&&req.method==='GET'){
        const id=String(url.searchParams.get('map_id')||'');
        const map=db.prepare('SELECT id,name,venue_id FROM venue_maps WHERE id=?').get(id);
        if(!map)return json(res,404,{error:'Mapa não encontrado.'});
        const areas=db.prepare('SELECT id,name,kind,x,y,width,height,gps_json FROM map_areas WHERE map_id=?').all(id).map(a=>({...a,gps:JSON.parse(a.gps_json||'{}'),gps_json:undefined}));
        const markers=db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get(id);
        return json(res,200,{map,areas,markers:JSON.parse(markers?.markers_json||'[]')});
      }
      if(url.pathname.startsWith('/api/admin/')){
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login.'});
        if(!isAdmin(user))return json(res,403,{error:'Acesso restrito a administradores.'});
        const key=url.pathname.slice('/api/admin/'.length);
        const tables={venues:'venues',maps:'venue_maps',areas:'map_areas',events:'events'};
        if(req.method==='GET'&&tables[key]){
          const rows=db.prepare('SELECT * FROM '+tables[key]).all();
          return json(res,200,{items:rows.map(row=>key==='events'?{...row,lineup:JSON.parse(row.lineup_json),map_ids:db.prepare('SELECT map_id FROM event_maps WHERE event_id=?').all(row.id).map(x=>x.map_id)}:key==='areas'?{...row,gps:JSON.parse(row.gps_json)}:row)});
        }
        if(req.method==='GET'&&key==='overview'){
          const cutoff=Date.now()-15*60*1000;
          return json(res,200,{totalUsers:db.prepare('SELECT COUNT(*) n FROM users').get().n,activeUsers:db.prepare('SELECT COUNT(*) n FROM user_activity WHERE last_seen>?').get(cutoff).n,sharingNow:db.prepare('SELECT COUNT(*) n FROM live_locations WHERE updated_at>?').get(Date.now()-90000).n,activeWindowMinutes:15});
        }
        if(req.method==='POST'&&key==='edit-venue'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100);
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(id))return json(res,400,{error:'Estabelecimento inválido.'});
          db.prepare('UPDATE venues SET name=?,address=?,city=? WHERE id=?').run(name,String(b.address||'').slice(0,300),String(b.city||'').slice(0,100),id);return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='edit-map'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||'');
          if(!name||!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(id)||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId))return json(res,400,{error:'Mapa inválido.'});
          db.prepare('UPDATE venue_maps SET name=?,venue_id=? WHERE id=?').run(name,venueId,id);return json(res,200,{ok:true});
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
          const id=randomUUID();db.prepare('INSERT INTO venues VALUES(?,?,?,?,?)').run(id,name,String(b.address||''),String(b.city||''),Date.now());return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='maps'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),venue=String(b.venue_id||'');
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venue))return json(res,400,{error:'Estabelecimento e nome obrigatórios.'});
          const id=randomUUID();db.prepare('INSERT INTO venue_maps VALUES(?,?,?,?)').run(id,venue,name,Date.now());return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='areas'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),mapId=String(b.map_id||''),nums=[b.x,b.y,b.width,b.height].map(Number);
          if(!name||!db.prepare('SELECT 1 FROM venue_maps WHERE id=?').get(mapId)||nums.some(x=>!Number.isFinite(x))||nums[0]<0||nums[1]<0||nums[2]<=0||nums[3]<=0||nums[0]+nums[2]>100||nums[1]+nums[3]>100)return json(res,400,{error:'Nome, mapa ou dimensões inválidos.'});
          const id=randomUUID();db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height) VALUES(?,?,?,?,?,?,?,?)').run(id,mapId,name,String(b.kind||'principal'),...nums);return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='gps'){
          const b=await body(req),area=db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get(String(b.id||'')),corner=String(b.corner||''),lat=Number(b.lat),lng=Number(b.lng),accuracy=Number(b.accuracy);
          if(!area||!['tl','tr','br','bl'].includes(corner)||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180||!Number.isFinite(accuracy)||accuracy<0)return json(res,400,{error:'GPS inválido.'});
          const gps=JSON.parse(area.gps_json);gps[corner]={lat,lng,accuracy};db.prepare('UPDATE map_areas SET gps_json=? WHERE id=?').run(JSON.stringify(gps),b.id);return json(res,200,{gps});
        }
        if(req.method==='POST'&&key==='events'){
          const b=await body(req),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||''),ids=[...new Set(Array.isArray(b.map_ids)?b.map_ids:[])];
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId)||!ids.length||ids.some(id=>!db.prepare('SELECT 1 FROM venue_maps WHERE id=? AND venue_id=?').get(id,venueId)))return json(res,400,{error:'Nome, estabelecimento ou mapas inválidos. Todos os mapas devem pertencer ao mesmo estabelecimento.'});
          const id=randomUUID();db.exec('BEGIN');
          try{
            db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,venueId,name,String(b.description||''),String(b.starts_at||''),String(b.ends_at||''),String(b.site_url||''),String(b.tickets_url||''),String(b.instagram_url||''),JSON.stringify(Array.isArray(b.lineup)?b.lineup:[]),Date.now());
            for(const mapId of ids)db.prepare('INSERT INTO event_maps VALUES(?,?)').run(id,mapId);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,201,{id});
        }
        if(req.method==='POST'&&key==='seed-demo'){
          const existing=db.prepare("SELECT id FROM events WHERE name='SUBMUNDO 808 — Edição Demo'").get();
          if(existing)return json(res,409,{error:'Evento de demonstração já existe. Edite-o na lista de eventos.'});
          const venueId=randomUUID(),mapId=randomUUID(),eventId=randomUUID(),now=Date.now();
          const start=new Date(now+7*86400000);start.setHours(21,0,0,0);
          const local=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
          const slots=['DJ NØX','LUNA BASS','KAYO 808','VEXX','MAYA VOLT','DJ SUB 808'];
          const lineup=slots.map((nome,i)=>({nome,instagram:'dj_demo_'+(i+1),inicio:local(new Date(start.getTime()+i*55*60000)),fim:local(new Date(start.getTime()+(i+1)*55*60000))}));
          db.exec('BEGIN');try{
            db.prepare('INSERT INTO venues VALUES(?,?,?,?,?)').run(venueId,'Espaço Submundo — DEMO','Endereço fictício para testes','São Paulo',now);
            db.prepare('INSERT INTO venue_maps VALUES(?,?,?,?)').run(mapId,venueId,'Pista principal — DEMO',now);
            db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),mapId,'Pista principal','principal',8,10,75,75);
            db.prepare('INSERT INTO map_markers VALUES(?,?)').run(mapId,JSON.stringify([{id:randomUUID(),name:'Bar principal',type:'bar',x:20,y:25},{id:randomUUID(),name:'Banheiros',type:'banheiro',x:78,y:30},{id:randomUUID(),name:'Palco',type:'palco',x:45,y:12},{id:randomUUID(),name:'Entrada',type:'entrada',x:45,y:90}]));
            db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(eventId,venueId,'SUBMUNDO 808 — Edição Demo','Evento demonstrativo completo para testar a experiência do participante. DJs, local e horários são fictícios.',local(start),local(new Date(start.getTime()+6*55*60000)),'','','',JSON.stringify(lineup),now);
            db.prepare('INSERT INTO event_maps VALUES(?,?)').run(eventId,mapId);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,201,{id:eventId,venue_id:venueId,map_id:mapId,created:true});
        }
        if(req.method==='POST'&&key==='delete'){
          const b=await body(req),id=String(b.id||''),entity=String(b.entity||'');
          const table={venue:'venues',map:'venue_maps',area:'map_areas',event:'events'}[entity];
          if(!table)return json(res,400,{error:'Entidade inválida.'});
          if(!db.prepare('SELECT 1 FROM '+table+' WHERE id=?').get(id))return json(res,404,{error:'Registro não encontrado.'});
          if(entity==='venue'&&(db.prepare('SELECT 1 FROM venue_maps WHERE venue_id=?').get(id)||db.prepare('SELECT 1 FROM events WHERE venue_id=?').get(id)))return json(res,409,{error:'Exclua os mapas e eventos vinculados primeiro.'});
          if(entity==='map'&&db.prepare('SELECT 1 FROM event_maps WHERE map_id=?').get(id))return json(res,409,{error:'Remova o mapa dos eventos primeiro.'});
          db.exec('BEGIN');try{
            if(entity==='event')db.prepare('DELETE FROM event_maps WHERE event_id=?').run(id);
            if(entity==='map'){db.prepare('DELETE FROM map_areas WHERE map_id=?').run(id);db.prepare('DELETE FROM map_markers WHERE map_id=?').run(id);}
            db.prepare('DELETE FROM '+table+' WHERE id=?').run(id);db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,200,{ok:true});
        }
        if(req.method==='POST'&&key==='edit-event'){
          const b=await body(req),id=String(b.id||''),name=String(b.name||'').trim().slice(0,100),venueId=String(b.venue_id||''),ids=[...new Set(Array.isArray(b.map_ids)?b.map_ids:[])];
          if(!db.prepare('SELECT 1 FROM events WHERE id=?').get(id))return json(res,404,{error:'Evento não encontrado.'});
          if(!name||!db.prepare('SELECT 1 FROM venues WHERE id=?').get(venueId)||!ids.length||ids.some(mid=>!db.prepare('SELECT 1 FROM venue_maps WHERE id=? AND venue_id=?').get(mid,venueId)))return json(res,400,{error:'Nome, estabelecimento ou mapas inválidos.'});
          if(!Array.isArray(b.lineup)||b.lineup.length>100||b.lineup.some(d=>!d||typeof d.nome!=='string'||d.nome.length>120))return json(res,400,{error:'Lineup inválido.'});
          db.exec('BEGIN');try{
            db.prepare('UPDATE events SET name=?,venue_id=?,description=?,starts_at=?,ends_at=?,site_url=?,tickets_url=?,instagram_url=?,lineup_json=? WHERE id=?').run(name,venueId,String(b.description||'').slice(0,2000),String(b.starts_at||''),String(b.ends_at||''),String(b.site_url||''),String(b.tickets_url||''),String(b.instagram_url||''),JSON.stringify(b.lineup),id);
            db.prepare('DELETE FROM event_maps WHERE event_id=?').run(id);
            for(const mid of ids)db.prepare('INSERT INTO event_maps VALUES(?,?)').run(id,mid);
            db.exec('COMMIT');
          }catch(e){db.exec('ROLLBACK');throw e;}
          return json(res,200,{ok:true});
        }
        return json(res,404,{error:'Operação administrativa não encontrada.'});
      }
      if (url.pathname==='/api/auth/me' && req.method==='GET') {const user=getUser(req);return json(res,200,{user:user?{...user,isAdmin:isAdmin(user)}:null});}
      if (url.pathname==='/api/auth/demo-admin' && req.method==='POST') {
        if(process.env.ENABLE_DEMO_USERS!=='true' || process.env.ENABLE_DEMO_ADMIN!=='true')return json(res,403,{error:'Criação de administrador de teste desativada. Configure ENABLE_DEMO_USERS e ENABLE_DEMO_ADMIN.'});
        const id=randomUUID(),suffix=randomBytes(6).toString('hex');
        const name='Admin Teste '+suffix.slice(0,6).toUpperCase();
        const email='admin-teste-'+suffix+'@example.invalid';
        const password=randomBytes(24).toString('base64url');
        db.exec('BEGIN');
        try{
          db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,email,passwordHash(password),Date.now());
          db.prepare('INSERT INTO admin_users VALUES(?,?)').run(id,Date.now());
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
        createSession(res,id);
        return json(res,201,{user:{id,name,email,isAdmin:true},password});
      }
      if (url.pathname==='/api/auth/demo' && req.method==='POST') {
        if(process.env.ENABLE_DEMO_USERS!=='true') return json(res,403,{error:'Contas de teste desativadas neste ambiente.'});
        const id=randomUUID();const suffix=randomBytes(5).toString('hex');
        const name='Teste '+suffix.slice(0,6).toUpperCase();
        const email='teste-'+suffix+'@example.invalid';
        const password=randomBytes(24).toString('base64url');
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,email,passwordHash(password),Date.now());
        createSession(res,id);
        return json(res,201,{user:{id,name,email},password});
      }
      if (url.pathname==='/api/auth/register' && req.method==='POST') {
        const b=await body(req);const name=String(b.name||'').trim().slice(0,60),email=String(b.email||'').trim().toLowerCase(),pass=String(b.password||'');
        if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || pass.length<10 || pass.length>128) return json(res,400,{error:'Informe nome, e-mail válido e senha de 10 a 128 caracteres.'});
        if(db.prepare('SELECT id FROM users WHERE email=?').get(email)) return json(res,409,{error:'E-mail já cadastrado.'});
        const id=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,name,email,passwordHash(pass),Date.now());createSession(res,id);return json(res,201,{user:{id,name,email}});
      }
      if (url.pathname==='/api/auth/login' && req.method==='POST') {
        const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const pass=String(b.password||'');const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if(!user || !validPassword(pass,user.password)) return json(res,401,{error:'E-mail ou senha incorretos.'});
        createSession(res,user.id);return json(res,200,{user:{id:user.id,name:user.name,email:user.email}});
      }
      if (url.pathname==='/api/auth/logout' && req.method==='POST') { const token=cookie(req,'sid');if(token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));res.setHeader('Set-Cookie',sessionCookie('',0));return json(res,200,{ok:true}); }
      if (url.pathname==='/api/auth/password' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Faça login primeiro.'});
        const b=await body(req);const stored=db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
        if(!validPassword(String(b.current||''),stored.password))return json(res,400,{error:'Senha atual incorreta.'});
        const pass=String(b.password||'');if(pass.length<10 || pass.length>128)return json(res,400,{error:'A nova senha precisa ter entre 10 e 128 caracteres.'});
        db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(pass),user.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);createSession(res,user.id);
        return json(res,200,{ok:true});
      }
      if (url.pathname==='/api/auth/forgot' && req.method==='POST') {
        if(!process.env.RESEND_API_KEY || !process.env.RESET_FROM_EMAIL) return json(res,503,{error:'Recuperação por e-mail ainda não configurada pelo administrador.'});
        const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const user=db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
        if(user) {const token=randomBytes(32).toString('hex');const tokenHash=hashToken(token);db.prepare('INSERT INTO resets VALUES(?,?,?)').run(tokenHash,user.id,Date.now()+1800000);
          const proto=req.headers['x-forwarded-proto']==='https'?'https':'https';const host=req.headers['x-forwarded-host']||req.headers.host;const link=`${proto}://${host}/?reset=${encodeURIComponent(token)}`;
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
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
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
