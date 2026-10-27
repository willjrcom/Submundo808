import test from 'node:test';
import assert from 'node:assert/strict';
import {signJwt,verifyJwt,authCookie,JWT_TTL_SECONDS} from '../server/auth.mjs';
const secret='a'.repeat(64),now=Date.UTC(2026,9,25);
test('JWT válido identifica usuário e versão',()=>{const token=signJwt('user-1',2,secret,now);const c=verifyJwt(token,secret,now+1000);assert.equal(c.sub,'user-1');assert.equal(c.ver,2);});
test('JWT rejeita alteração de payload',()=>{const token=signJwt('user-1',0,secret,now);const [h,p,s]=token.split('.');const changed=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(p,'base64url').toString()),sub:'admin'})).toString('base64url');assert.equal(verifyJwt(h+'.'+changed+'.'+s,secret,now),null);});
test('JWT rejeita assinatura de outro servidor',()=>assert.equal(verifyJwt(signJwt('u',0,secret,now),'b'.repeat(64),now),null));
test('JWT rejeita expiração',()=>assert.equal(verifyJwt(signJwt('u',0,secret,now),secret,now+JWT_TTL_SECONDS*1000),null));
test('JWT rejeita token malformado',()=>{for(const token of ['','a.b.c','x','x.y.z.a',null])assert.equal(verifyJwt(token,secret,now),null);});
test('cookie persistente compartilhado com admin',()=>{const cookie=authCookie('abc',JWT_TTL_SECONDS,{headers:{host:'submundo.menudevendas.com.br'}});assert.match(cookie,/Domain=submundo\.menudevendas\.com\.br/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Max-Age=2592000/);});
test('logout limpa cookie',()=>assert.match(authCookie('',0),/Max-Age=0/));

test('cookie compartilha login entre site e admin',()=>{
  for(const host of ['submundo.menudevendas.com.br','admin.submundo.menudevendas.com.br']){
    assert.match(authCookie('token',JWT_TTL_SECONDS,{headers:{host}}),/Domain=submundo\.menudevendas\.com\.br/);
  }
});
test('domínio alternativo não recebe cookie inválido',()=>{
  const cookie=authCookie('token',JWT_TTL_SECONDS,{headers:{host:'preview.example.com'}});
  assert.doesNotMatch(cookie,/Domain=/);
  assert.match(cookie,/HttpOnly/);
});
test('ambiente local permite cookie sem Secure',()=>{
  const cookie=authCookie('token',JWT_TTL_SECONDS,{headers:{host:'localhost:3000'}});
  assert.doesNotMatch(cookie,/; Secure/);
});

test('cookie JWT tem nome diferente do cookie de sessão antigo',()=>{
  const c=authCookie('token',JWT_TTL_SECONDS,{headers:{host:'submundo.menudevendas.com.br'}});
  assert.match(c,/^submundo_jwt=token;/);
  assert.doesNotMatch(c,/^sid=/);
});
