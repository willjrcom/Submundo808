import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 80);
const DATA = process.env.DATA_DIR || '/data';
const PUBLIC = '/app/public';
fs.mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'submundo.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friend_codes (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships (user_a TEXT NOT NULL, user_b TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_a,user_b));`);
const json = (res, status, body, headers={}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const hashToken = value => createHash('sha256').update(value).digest('hex');
const passwordHash = pass => { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(pass, salt, 64).toString('hex'); };
const validPassword = (pass, stored) => { const [salt, expected] = stored.split(':'); if (!salt || !expected) return false; const actual = scryptSync(pass, salt, 64); const wanted = Buffer.from(expected, 'hex'); return actual.length === wanted.length && timingSafeEqual(actual, wanted); };
const cookie = (req, key) => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(key + '='))?.slice(key.length + 1);
const getUser = req => { const token = cookie(req, 'sid'); if (!token) return null; return db.prepare('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token), Date.now()) || null; };
const sessionCookie = (token, maxAge=604800) => `sid=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
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
        db.prepare('DELETE FROM friend_codes WHERE user_id=? OR expires_at<?').run(user.id,Date.now());
        const token=randomBytes(24).toString('hex');
        db.prepare('INSERT INTO friend_codes VALUES(?,?,?)').run(hashToken(token),user.id,Date.now()+60000);
        return json(res,200,{token,expiresAt:Date.now()+60000});
      }
      if (url.pathname==='/api/friends/add' && req.method==='POST') {
        const user=getUser(req);if(!user)return json(res,401,{error:'Entre na sua conta.'});
        const b=await body(req);let token=String(b.token||'');
        try { if(token.includes('://'))token=new URL(token).searchParams.get('invite')||''; }catch{}
        if(!/^[a-f0-9]{48}$/.test(token))return json(res,400,{error:'QR Code inválido. Peça um novo código.'});
        const row=db.prepare('SELECT c.user_id,u.name FROM friend_codes c JOIN users u ON u.id=c.user_id WHERE c.token_hash=? AND c.expires_at>?').get(hashToken(token),Date.now());
        if(!row)return json(res,410,{error:'QR Code expirado. Peça para atualizar o perfil.'});
        if(row.user_id===user.id)return json(res,400,{error:'Você não pode adicionar a si mesmo.'});
        const [a,bId]=[user.id,row.user_id].sort();
        db.prepare('INSERT OR IGNORE INTO friendships VALUES(?,?,?)').run(a,bId,Date.now());
        db.prepare('DELETE FROM friend_codes WHERE token_hash=?').run(hashToken(token));
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
      if (url.pathname==='/api/auth/me' && req.method==='GET') return json(res,200,{user:getUser(req)});
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
