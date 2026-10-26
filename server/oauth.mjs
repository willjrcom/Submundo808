import {randomBytes,randomUUID,createHash} from 'node:crypto';
const states=new Map();
const asUrl=bytes=>Buffer.from(bytes).toString('base64url');
export function createOauth({db,getUser,createSession,passwordHash}){
 db.exec("CREATE TABLE IF NOT EXISTS oauth_links(provider TEXT NOT NULL,external_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(provider,external_id),UNIQUE(provider,user_id))");
 db.exec("CREATE TABLE IF NOT EXISTS meaple_tokens(user_id TEXT PRIMARY KEY,access_token TEXT NOT NULL,refresh_token TEXT NOT NULL DEFAULT '',expires_at INTEGER NOT NULL)");
 const reply=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 const go=(res,location)=>{res.writeHead(302,{Location:location,'Cache-Control':'no-store'});res.end();};
 async function handle(req,res,url){
  if(url.pathname==='/api/auth/providers')return reply(res,{google:!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_REDIRECT_URI),meaple:!!(process.env.MEAPLE_CLIENT_ID&&process.env.MEAPLE_REDIRECT_URI)});
  const match=url.pathname.match(/^\/api\/auth\/(google|meaple)\/(start|callback)$/);
  if(!match)return false;
  const [,provider,action]=match;
  const clientId=process.env[provider==='google'?'GOOGLE_CLIENT_ID':'MEAPLE_CLIENT_ID'];
  const redirectUri=process.env[provider==='google'?'GOOGLE_REDIRECT_URI':'MEAPLE_REDIRECT_URI'];
  if(!clientId||!redirectUri)return reply(res,{error:'Provedor não configurado.'},503);
  if(action==='start'){
   const state=asUrl(randomBytes(24)),verifier=asUrl(randomBytes(32));
   states.set(state,{provider,verifier,uid:getUser(req)?.id,exp:Date.now()+300000});
   const target=new URL(provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://whitelabel.meaple.app/api/oauth/authorize');
   for(const [key,value] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',state,scope:provider==='google'?'openid email profile':'profile email'}))target.searchParams.set(key,value);
   if(provider==='meaple'){target.searchParams.set('code_challenge',asUrl(createHash('sha256').update(verifier).digest()));target.searchParams.set('code_challenge_method','S256');target.searchParams.set('theme','dark');target.searchParams.set('primary_color','c4ff40');}
   return go(res,target.toString());
  }
  const state=url.searchParams.get('state'),flow=states.get(state);states.delete(state);
  if(!flow||flow.provider!==provider||flow.exp<Date.now()||!url.searchParams.get('code'))return go(res,'/login?auth_error=invalid');
  try{
   const payload=new URLSearchParams({grant_type:'authorization_code',client_id:clientId,redirect_uri:redirectUri,code:url.searchParams.get('code')});
   if(provider==='google')payload.set('client_secret',process.env.GOOGLE_CLIENT_SECRET);
   else payload.set('code_verifier',flow.verifier);
   const tokenResponse=await fetch(provider==='google'?'https://oauth2.googleapis.com/token':'https://whitelabel.meaple.app/api/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:payload,signal:AbortSignal.timeout(12000)});
   if(!tokenResponse.ok)throw Error('token exchange');
   const token=await tokenResponse.json();
   const infoResponse=await fetch(provider==='google'?'https://openidconnect.googleapis.com/v1/userinfo':'https://api.meaple.com.br/v1/users/me',{headers:{Authorization:'Bearer '+token.access_token,...(provider==='meaple'?{'X-Channel-Id':clientId}:{})},signal:AbortSignal.timeout(12000)});
   if(!infoResponse.ok)throw Error('identity lookup');
   const info=await infoResponse.json(),profile=provider==='google'?info:info.user;
   const externalId=String(provider==='google'?profile.sub:profile.id);
   if(!externalId||externalId==='undefined'||externalId.length>200)throw Error('missing identity');
   const linked=db.prepare('SELECT user_id FROM oauth_links WHERE provider=? AND external_id=?').get(provider,externalId);
   let userId=linked?.user_id;
   if(flow.uid){if(userId&&userId!==flow.uid)return go(res,'/profile?auth_error=linked');userId=flow.uid;db.prepare('INSERT OR IGNORE INTO oauth_links VALUES(?,?,?)').run(provider,externalId,userId);}
   else if(!userId){
    const email=String(profile.email||'').trim().toLowerCase();
    if(email&&db.prepare('SELECT id FROM users WHERE email=?').get(email))return go(res,'/login?auth_error=link_required');
    userId=randomUUID();
    const fallback=provider+'-'+createHash('sha256').update(externalId).digest('hex').slice(0,20)+'@oauth.invalid';
    db.prepare('INSERT INTO users(id,name,email,password,created_at) VALUES(?,?,?,?,?)').run(userId,String(profile.name||'Participante').slice(0,60),email&&email.includes('@')?email:fallback,passwordHash(asUrl(randomBytes(36))),Date.now());
    db.prepare('INSERT INTO oauth_links VALUES(?,?,?)').run(provider,externalId,userId);
   }
   if(provider==='meaple')db.prepare('INSERT INTO meaple_tokens VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at').run(userId,token.access_token,token.refresh_token||'',Date.now()+(Number(token.expires_in)||3600)*1000);
   createSession(req,res,userId);return go(res,'/profile');
  }catch(error){console.error('OAuth failure',provider,error.message);return go(res,'/login?auth_error=provider');}
 }
 return handle;
}
