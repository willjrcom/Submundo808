import test from 'node:test';
import assert from 'node:assert/strict';
import {allowPostOrigin,clientIp,createWindowLimiter,publicAppOrigin,securityHeaders} from '../server/request-security.mjs';

test('bloqueia origens externas inclusive com x-forwarded-host falsificado',()=>{
 const req={headers:{host:'submundo.menudevendas.com.br','x-forwarded-host':'evil.test',origin:'https://evil.test'}};
 assert.equal(allowPostOrigin(req),false);
 req.headers.origin='https://submundo.menudevendas.com.br';
 assert.equal(allowPostOrigin(req),true);
 req.headers.origin='null';assert.equal(allowPostOrigin(req),false);
});
test('Sec-Fetch-Site cross-site é bloqueado quando Origin não está presente',()=>{
 assert.equal(allowPostOrigin({headers:{host:'submundo.menudevendas.com.br','sec-fetch-site':'cross-site'}}),false);
 assert.equal(allowPostOrigin({headers:{host:'submundo.menudevendas.com.br','sec-fetch-site':'same-origin'}}),true);
});
test('IP da conexão prevalece sobre X-Forwarded-For não confiável',()=>{
 const req={headers:{'x-forwarded-for':'203.0.113.4, 10.0.0.1'},socket:{remoteAddress:'172.18.0.2'}};
 assert.equal(clientIp(req),'172.18.0.2');
 assert.equal(clientIp(req,{trustProxy:true}),'203.0.113.4');
 req.headers['x-forwarded-for']='injetado';assert.equal(clientIp(req,{trustProxy:true}),'172.18.0.2');
});
test('limitador reinicia após janela e aceita limpeza após login',()=>{
 const limiter=createWindowLimiter({limit:2,windowMs:100});
 assert.equal(limiter.hit('a',1000),false);
 assert.equal(limiter.hit('a',1001),false);
 assert.equal(limiter.hit('a',1002),true);
 assert.equal(limiter.hit('a',1100),false);
 limiter.clear('a');assert.equal(limiter.hit('a',1101),false);
});
test('origem pública impede link de reset controlado por domínio arbitrário',()=>{
 assert.equal(publicAppOrigin(undefined),'https://submundo.menudevendas.com.br');
 assert.equal(publicAppOrigin('https://exemplo.com'),'https://exemplo.com');
 assert.throws(()=>publicAppOrigin('http://evil.test'));
 assert.throws(()=>publicAppOrigin('https://evil.test/attack'));
 assert.throws(()=>publicAppOrigin('https://user:pass@evil.test'));
});
test('headers HTTP impedem iframe, sniffing e indiscrição de referência',()=>{
 const headers=securityHeaders({headers:{'x-forwarded-proto':'https'}});
 assert.equal(headers['X-Frame-Options'],'DENY');
 assert.equal(headers['X-Content-Type-Options'],'nosniff');
 assert.equal(headers['Strict-Transport-Security'],'max-age=31536000');
});
