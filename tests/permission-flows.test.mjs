import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {permissionFailure,requestGpsPosition,requestCameraAccess,registerPush,requestNativeInstallation} from '../artifacts/submundo-808/src/components/permission-flows.mjs';
const code=readFileSync(new URL('../artifacts/submundo-808/src/components/profile-permissions.tsx',import.meta.url),'utf8');
const platform=readFileSync(new URL('../artifacts/submundo-808/src/components/pwa-installation.ts',import.meta.url),'utf8');

test('GPS: sucesso retorna posição, negação e timeout dão orientação diferente',async()=>{
 const position={coords:{latitude:-23.5,longitude:-47.4}};
 const geo={getCurrentPosition(success,fail,options){assert.equal(options.timeout,18000);success(position);}};
 assert.equal(await requestGpsPosition(geo),position);
 await assert.rejects(()=>requestGpsPosition({getCurrentPosition(_,fail){fail({code:1});}}),error=>error.code===1);
 assert.throws(()=>requestGpsPosition(null),/GPS indisponível/);
 assert.match(permissionFailure('location',{code:1}).message,/Como liberar/);
 assert.equal(permissionFailure('location',{code:1}).denied,true);
 assert.match(permissionFailure('location',{code:3}).message,/demorou/);
 assert.match(permissionFailure('location',{code:2}).message,/posição/);
 assert.equal(permissionFailure('location',{code:3}).denied,false);
});

test('Câmera: sucesso sempre libera trilhas e erros de bloqueio e ocupação são distinguíveis',async()=>{
 let stopped=0;
 const media={getUserMedia:async options=>{assert.equal(options.video.facingMode,'environment');return {getTracks:()=>[{stop(){stopped++;}},{stop(){stopped++;}}]};}};
 assert.equal(await requestCameraAccess(media),true);
 assert.equal(stopped,2);
 await assert.rejects(()=>requestCameraAccess({getUserMedia:async()=>{throw {name:'NotAllowedError'};}}));
 assert.match(permissionFailure('camera',{name:'NotAllowedError'}).message,/Como liberar/);
 assert.match(permissionFailure('camera',{name:'NotFoundError'}).message,/Nenhuma câmera/);
 assert.match(permissionFailure('camera',{name:'NotReadableError'}).message,/ocupada/);
 await assert.rejects(()=>requestCameraAccess({}),/câmera não está disponível/);
});

const sub={toJSON(){return {endpoint:'https://push.example/test',keys:{}};}};
const config={enabled:true,publicKey:'Zg'};
const reply=(body,ok=true)=>({ok,async json(){return body;}});
function mockPush({permission='default',result='granted',existing=null,configOk=true,subscribeOk=true}={}){
 const steps=[];
 const notification={permission,requestPermission(){steps.push('permission');return Promise.resolve(result);}};
 const registration={pushManager:{
  async getSubscription(){steps.push('getSubscription');return existing;},
  async subscribe(input){steps.push('subscribe');assert.equal(input.userVisibleOnly,true);assert.ok(input.applicationServerKey instanceof Uint8Array);return sub;}
 }};
 const fetchFn=async(url,init)=>{steps.push(url);if(url.endsWith('/config'))return reply(config,configOk);if(url.endsWith('/subscribe')){assert.equal(init.method,'POST');assert.equal(JSON.parse(init.body).subscription.endpoint,sub.toJSON().endpoint);return reply({ok:true},subscribeOk);}throw Error('unexpected URL');};
 return {notification,steps,registration,fetchFn};
}
const callPush=mock=>registerPush({notification:mock.notification,serviceWorker:{ready:Promise.resolve(mock.registration)},pushSupported:true,request:mock.fetchFn,decode:()=>String.fromCharCode(102)});

test('Push: pedido de permissão precede qualquer chamada de rede no iPhone',async()=>{
 const mock=mockPush();
 assert.equal(await callPush(mock),sub);
 assert.deepEqual(mock.steps,['permission','/api/push/config','getSubscription','subscribe','/api/push/subscribe']);
 const registered=mockPush({permission:'granted',existing:sub});
 await callPush(registered);
 assert.ok(!registered.steps.includes('permission'));
 assert.ok(!registered.steps.includes('subscribe'));
});

test('Push: negação, cancelamento, configuração inativa e falha HTTP têm mensagens específicas',async()=>{
 const denied=mockPush({permission:'denied'});
 await assert.rejects(()=>callPush(denied),error=>error.name==='NotAllowedError');
 assert.deepEqual(denied.steps,[]);
 const rejected=mockPush({result:'denied'});
 await assert.rejects(()=>callPush(rejected),error=>error.name==='NotAllowedError');
 assert.deepEqual(rejected.steps,['permission']);
 const canceled=mockPush({result:'default'});
 await assert.rejects(()=>callPush(canceled),/cancelada/);
 const missing=mockPush({configOk:false});
 await assert.rejects(()=>callPush(missing),/configuração/);
 const error=mockPush({subscribeOk:false});
 await assert.rejects(()=>callPush(error),/registrar/);
 await assert.rejects(()=>registerPush({notification:null,serviceWorker:null,pushSupported:false}),/indisponíveis/);
});

test('Instalação Android: aceita, cancela, fica pendente ou falha sem mostrar falso sucesso',async()=>{
 const prompt=outcome=>({async prompt(){},userChoice:Promise.resolve({outcome})});
 assert.equal(await requestNativeInstallation(prompt('accepted')),'accepted');
 assert.equal(await requestNativeInstallation(prompt('dismissed')),'dismissed');
 assert.equal(await requestNativeInstallation({async prompt(){}}),'pending');
 await assert.rejects(()=>requestNativeInstallation(null),/Instalação automática indisponível/);
 await assert.rejects(()=>requestNativeInstallation({async prompt(){throw Error('blocked');}}),/blocked/);
});

test('iPhone: tutorial é portal independente com controle de foco, Escape e instrução para browsers internos',()=>{
 assert.match(code,/createPortal\(<div role="presentation"/);
 assert.match(code,/document\.body\)\}/);
 assert.match(code,/z-\[9999\]/);
 assert.match(code,/pt-\[max\(16px,env\(safe-area-inset-top\)\)\]/);
 assert.match(code,/tutorialCloseRef\.current\?\.focus\(\)/);
 assert.match(code,/event\.key==='Escape'/);
 assert.match(code,/Ver como instalar/);
 assert.doesNotMatch(code,/Notificações bloqueadas até instalar o aplicativo/);
 assert.match(code,/embeddedIos&&<p role="status"/);
 assert.match(platform,/isIosEmbeddedBrowser/);
 assert.match(platform,/WhatsApp\|Instagram\|FBAN/);
 assert.match(platform,/getDeferredInstallPrompt/);
 assert.match(platform,/window\.addEventListener\('beforeinstallprompt'/);
});

test('Permissões: ações incluem feedback individual, estado ocupado e retorno de privacidade',()=>{
 assert.match(code,/noticeTone==='error'/);
 assert.match(code,/setNotice\('location',result\.message,'error'\)/);
 assert.match(code,/setNotice\('notifications',result\.message,'error'\)/);
 assert.match(code,/setNotice\('camera',result\.message,'error'\)/);
 assert.match(code,/setNotice\('location',.*,'success'\)/);
 assert.match(code,/setNotice\('notifications',.*,'success'\)/);
 assert.match(code,/setNotice\('camera',.*,'success'\)/);
 assert.match(code,/if\(result\.denied\)update\('camera','denied'\)/);
 assert.match(code,/if\(result\.denied\|\|\('Notification'in window&&Notification\.permission==='denied'\)\)update\('notifications','denied'\)/);
 assert.match(code,/Como liberar/);
 assert.match(code,/window\.addEventListener\('pageshow',onFocus\)/);
 assert.match(code,/Encerrar localização e compartilhamento/);
 assert.match(code,/localStorage\.setItem\('submundo-gps-stop-pending','1'\)/);
});
