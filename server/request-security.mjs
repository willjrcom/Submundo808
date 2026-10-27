import {isIP} from 'node:net';
// Segurança de requisições: funções sem estado global, testáveis isoladamente.
const DEFAULT_ORIGIN='https://submundo.menudevendas.com.br';

export function publicAppOrigin(configured=process.env.PUBLIC_APP_ORIGIN){
 if(!configured)return DEFAULT_ORIGIN;
 let url;
 try{url=new URL(configured);}catch{throw new Error('PUBLIC_APP_ORIGIN deve ser uma origem HTTPS válida.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||
    (url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))){
  throw new Error('PUBLIC_APP_ORIGIN deve ser uma origem HTTPS válida (HTTP apenas para localhost).');
 }
 return url.origin;
}

// O cliente nunca pode escolher seu IP via X-Forwarded-For sem confiança explícita no proxy.
// Se TRUST_PROXY=true, o proxy de borda DEVE substituir e higienizar X-Forwarded-For.
export function clientIp(req,{trustProxy=false}={}){
 const direct=String(req.socket?.remoteAddress||'unknown').slice(0,64);
 if(!trustProxy)return direct;
 const first=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
 return isIP(first)?first:direct;
}

export function allowPostOrigin(req){
 const origin=req.headers?.origin;
 if(origin){
  try{
   const parsed=new URL(origin);
   return ['http:','https:'].includes(parsed.protocol)&&parsed.host.toLowerCase()===String(req.headers?.host||'').toLowerCase();
  }catch{return false;}
 }
 // Origin pode faltar em clientes legítimos antigos; bloquear quando o navegador
 // confirma explicitamente que a requisição vem de outro site.
 return req.headers?.['sec-fetch-site']!=='cross-site';
}

export function securityHeaders(req){
 const headers={
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'geolocation=(self), camera=(self), microphone=()'
 };
 if(req.socket?.encrypted||req.headers?.['x-forwarded-proto']==='https'){
  headers['Strict-Transport-Security']='max-age=31536000';
 }
 return headers;
}

export function createWindowLimiter({limit,windowMs,maxKeys=10000}){
 if(!Number.isInteger(limit)||limit<1||!Number.isInteger(windowMs)||windowMs<1)throw Error('Limites inválidos.');
 const buckets=new Map();
 return {
  hit(key,now=Date.now()){
   const current=buckets.get(key);
   if(!current||current.reset<=now){
    if(buckets.size>=maxKeys){
     for(const [candidate,value] of buckets){if(value.reset<=now)buckets.delete(candidate);}
     if(buckets.size>=maxKeys)buckets.clear();
    }
    buckets.set(key,{count:1,reset:now+windowMs});return false;
   }
   current.count++;
   return current.count>limit;
  },
  clear(key){buckets.delete(key);}
 };
}
