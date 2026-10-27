import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createSensitiveRouteLimiter} from '../server/route-limits.mjs';
import {contentSecurityPolicy,securityHeaders} from '../server/request-security.mjs';
import {routeFamily,requestAudit,logServerFault,cspReportSummary} from '../server/observability.mjs';

test('limite de recuperação por IP bloqueia após 12 operações e reinicia após janela',()=>{
 const limiter=createSensitiveRouteLimiter();
 for(let i=0;i<12;i++)assert.equal(limiter.check('/api/auth/forgot','POST','203.0.113.1',1000+i).blocked,false);
 const denied=limiter.check('/api/auth/forgot','POST','203.0.113.1',1013);
 assert.equal(denied.blocked,true);
 assert.equal(denied.group,'password-recovery');
 assert.equal(denied.retryAfter,600);
 assert.equal(limiter.check('/api/auth/forgot','POST','203.0.113.2',1014).blocked,false);
 assert.equal(limiter.check('/api/auth/forgot','POST','203.0.113.1',601001).blocked,false);
});

test('limites específicos separam cadastro, login, admin e mantêm atualização GPS normal',()=>{
 const limiter=createSensitiveRouteLimiter();
 assert.equal(limiter.check('/api/auth/login','POST','same-ip',1000).group,'login');
 assert.equal(limiter.check('/api/admin/notifications/dispatch','POST','same-ip',1000).group,'admin-changes');
 assert.equal(limiter.check('/api/auth/register','POST','same-ip',1000).group,'registration');
 assert.equal(limiter.check('/api/location/update','POST','same-ip',1000).blocked,false);
 assert.equal(limiter.check('/api/auth/forgot','GET','same-ip',1000).group,null);
});

test('CSP report-only por padrão e enforce apenas com opt-in configurado',()=>{
 const policy=contentSecurityPolicy();
 assert.match(policy,/script-src 'self'/);
 assert.match(policy,/object-src 'none'/);
 assert.match(policy,/report-uri \/api\/csp-report/);
 const req={headers:{}};
 const report=securityHeaders(req,{enforceCsp:false});
 assert.equal(report['Content-Security-Policy-Report-Only'],policy);
 assert.equal(report['Content-Security-Policy'],undefined);
 const enforced=securityHeaders(req,{enforceCsp:true});
 assert.equal(enforced['Content-Security-Policy'],policy);
 assert.equal(enforced['Content-Security-Policy-Report-Only'],undefined);
});

test('logs não contêm URL com tokens, e-mail, IP, detalhes de erros ou corpo',()=>{
 assert.equal(routeFamily('/api/auth/reset'), 'api/auth');
 assert.equal(routeFamily('/api/admin/password/reset'),'api/admin');
 const events=[];
 const res=new EventEmitter();
 res.statusCode=503;
 res.setHeader=()=>{};
 const id=requestAudit({method:'POST'},res,'/api/auth/reset?token=secret',{log:value=>events.push(value),clock:()=>5000});
 logServerFault(id,new Error('password=test@example.com bearer secret'),value=>events.push(value));
 res.emit('finish');
 assert.equal(events.length,2);
 const asText=events.join('\n');
 assert.doesNotMatch(asText,/test@example\.com|bearer secret|token=secret/);
 assert.match(asText,/requestId/);
 assert.match(asText,/api\/auth/);
});

test('telemetria CSP registra apenas diretiva sem endereços ou amostras',()=>{
 assert.deepEqual(cspReportSummary({'csp-report':{'violated-directive':'script-src unsafe-inline','blocked-uri':'https://example.com/?token=secret','script-sample':'password=123'}}),{directive:'script-src'});
});
