import fs from 'node:fs';
import path from 'node:path';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const JWT_TTL_SECONDS=30*24*60*60;
export const JWT_COOKIE_NAME='submundo_jwt';
const ISSUER='submundo-808';
const AUDIENCE='submundo-808-web';
const b64=data=>Buffer.from(JSON.stringify(data)).toString('base64url');
export function loadJwtSecret(dataDir){
  if(process.env.JWT_SECRET){if(Buffer.byteLength(process.env.JWT_SECRET)<32)throw Error('JWT_SECRET deve ter ao menos 32 bytes');return process.env.JWT_SECRET;}
  const file=path.join(dataDir,'jwt-secret');
  if(!fs.existsSync(file))fs.writeFileSync(file,randomBytes(48).toString('base64url'),{mode:0o600,flag:'wx'});
  return fs.readFileSync(file,'utf8').trim();
}
export function signJwt(userId,version,secret,now=Date.now()){
  const header=b64({alg:'HS256',typ:'JWT'});
  const payload=b64({sub:userId,ver:version,iss:ISSUER,aud:AUDIENCE,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+JWT_TTL_SECONDS});
  const data=header+'.'+payload;
  const signature=createHmac('sha256',secret).update(data).digest('base64url');
  return data+'.'+signature;
}
export function verifyJwt(token,secret,now=Date.now()){
  if(typeof token!=='string'||token.length>4096)return null;
  const parts=token.split('.');
  if(parts.length!==3)return null;
  const [h,p,s]=parts;
  try{
    const header=JSON.parse(Buffer.from(h,'base64url').toString('utf8'));
    if(header.alg!=='HS256'||header.typ!=='JWT')return null;
    const actual=createHmac('sha256',secret).update(h+'.'+p).digest();
    const provided=Buffer.from(s,'base64url');
    if(actual.length!==provided.length||!timingSafeEqual(actual,provided))return null;
    const claims=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
    const time=Math.floor(now/1000);
    if(claims.iss!==ISSUER||claims.aud!==AUDIENCE||typeof claims.sub!=='string'||!claims.sub||!Number.isSafeInteger(claims.ver)||claims.ver<0||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>time+60||claims.exp<=time||claims.exp-claims.iat>JWT_TTL_SECONDS)return null;
    return claims;
  }catch{return null;}
}
export function authCookie(token,maxAge=JWT_TTL_SECONDS,req){
  const hostname=String(req?.headers?.host||'').split(',')[0].trim().split(':')[0].toLowerCase();
  const shared=hostname==='submundo.menudevendas.com.br'||hostname.endsWith('.submundo.menudevendas.com.br');
  const domain=shared?'; Domain=submundo.menudevendas.com.br':'';
  const secure=hostname!=='localhost'&&hostname!=='127.0.0.1'?'; Secure':'';
  return JWT_COOKIE_NAME+'='+token+'; HttpOnly'+secure+'; SameSite=Lax'+domain+'; Path=/; Max-Age='+maxAge;
}
