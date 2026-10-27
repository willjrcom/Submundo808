import {randomUUID} from 'node:crypto';

// Sem armazenamento de dados pessoais: caminho agregado, ID gerado no servidor
// e status. Não registrar URL completa, corpo, cookies, e-mails nem GPS.
export function routeFamily(pathname){
 const pieces=String(pathname||'').split('/').filter(Boolean);
 if(pieces[0]!=='api')return 'web';
 return 'api/'+(pieces[1]||'unknown');
}
export function requestAudit(req,res,pathname,{log=console.log,clock=Date.now}={}){
 const id=randomUUID();
 const start=clock();
 res.setHeader('X-Request-ID',id);
 res.on('finish',()=>{
  if(res.statusCode!==429&&res.statusCode<500)return;
  log(JSON.stringify({timestamp:new Date(clock()).toISOString(),level:res.statusCode>=500?'error':'warn',event:'http_request',requestId:id,method:String(req.method||'GET').slice(0,8),route:routeFamily(pathname),status:res.statusCode,durationMs:Math.max(0,clock()-start)}));
 });
 return id;
}
export function logServerFault(requestId,error,log=console.error){
 // A mensagem de uma exceção pode conter SQL, parâmetros e tokens.
 const type=String(error?.name||'Error').replace(/[^A-Za-z]/g,'').slice(0,40)||'Error';
 log(JSON.stringify({timestamp:new Date().toISOString(),level:'error',event:'unexpected_exception',requestId,errorType:type}));
}
export function cspReportSummary(data){
 const report=data&&typeof data==='object'?(data['csp-report']||data):{};
 const value=String(report['violated-directive']||report.effectiveDirective||'unknown').split(' ')[0].replace(/[^a-z0-9-]/gi,'').slice(0,50);
 return {directive:value||'unknown'};
}
