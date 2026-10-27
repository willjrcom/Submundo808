import {createWindowLimiter} from './request-security.mjs';

// Limites por IP e tipo de ação. Não usar e-mail, token, cookie ou corpo na chave.
// Além destes limites, o servidor mantém o limite geral já existente.
const rules=[
 {group:'registration',method:'POST',pattern:/^\/api\/auth\/(register|demo|demo-admin)$/,limit:25,windowMs:10*60_000},
 {group:'password-recovery',method:'POST',pattern:/^\/api\/auth\/forgot$/,limit:12,windowMs:10*60_000},
 {group:'password-reset',method:'POST',pattern:/^\/api\/auth\/reset$/,limit:35,windowMs:10*60_000},
 {group:'login',method:'POST',pattern:/^\/api\/auth\/login$/,limit:60,windowMs:10*60_000},
 {group:'account-changes',method:'POST',pattern:/^\/api\/auth\/(password|profile)$/,limit:50,windowMs:10*60_000},
 {group:'friend-invites',method:'POST',pattern:/^\/api\/friends\/(add|code)$/,limit:120,windowMs:60_000},
 {group:'push-subscription',method:'POST',pattern:/^\/api\/push\/(subscribe|unsubscribe)$/,limit:60,windowMs:60_000},
 {group:'client-telemetry',method:'POST',pattern:/^\/api\/(client-errors|csp-report)$/,limit:80,windowMs:60_000},
 {group:'admin-changes',method:'POST',pattern:/^\/api\/admin\//,limit:300,windowMs:60_000}
];
export function createSensitiveRouteLimiter(){
 const limiters=rules.map(rule=>({...rule,limiter:createWindowLimiter({limit:rule.limit,windowMs:rule.windowMs})}));
 return {
  check(path,method,ip,now=Date.now()){
   const rule=limiters.find(r=>r.method===method&&r.pattern.test(path));
   if(!rule)return {blocked:false,group:null,retryAfter:0};
   const blocked=rule.limiter.hit(ip,now);
   return {blocked,group:rule.group,retryAfter:blocked?Math.ceil(rule.windowMs/1000):0};
  }
 };
}
