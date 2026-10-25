import test from 'node:test';
import assert from 'node:assert/strict';
import {startInitialGps,gpsErrorText,GPS_STARTUP_TIMEOUT_MS} from '../artifacts/submundo-808/src/components/gps-acquisition.ts';
import {readFileSync} from 'node:fs';

function fixture(){
 const calls=[];
 let nextId=0;
 const scheduled=new Map();
 const clock={
  setTimeout(fn,delay){const id=++nextId;scheduled.set(id,{fn,delay});return id;},
  clearTimeout(id){scheduled.delete(id);}
 };
 const geolocation={
  getCurrentPosition(success,error,options){calls.push({success,error,options});}
 };
 return {calls,scheduled,clock,geolocation};
}
test('o clique solicita a primeira posição de forma síncrona, sem esperar o servidor',()=>{
 const f=fixture();let received=0;
 const cancel=startInitialGps(f.geolocation,{onSuccess:()=>received++,onError:()=>{}},f.clock);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].options.enableHighAccuracy,false);
 assert.equal(f.calls[0].options.maximumAge,0);
 assert.equal(f.calls[0].options.timeout,15000);
 f.calls[0].success({timestamp:123,coords:{latitude:-23,longitude:-46,accuracy:20}});
 assert.equal(received,1);
 assert.equal(f.scheduled.size,0);
 cancel();
});
test('o cronômetro de segurança libera o estado carregando mesmo sem callback do Android',()=>{
 const f=fixture();let failure;
 startInitialGps(f.geolocation,{onSuccess:()=>{},onError:error=>failure=error},f.clock);
 const tasks=[...f.scheduled.values()];
 assert.equal(tasks.length,1);
 assert.equal(tasks[0].delay,GPS_STARTUP_TIMEOUT_MS);
 tasks[0].fn();
 assert.equal(failure.code,3);
 assert.equal(f.scheduled.size,0);
});
test('callback atrasado depois do tempo limite não altera a interface',()=>{
 const f=fixture();let success=0,failure=0;
 startInitialGps(f.geolocation,{onSuccess:()=>success++,onError:()=>failure++},f.clock);
 [...f.scheduled.values()][0].fn();
 f.calls[0].success({timestamp:123});
 f.calls[0].error({code:1});
 assert.deepEqual([success,failure],[0,1]);
});
test('cancelar pedido impede callbacks tardios',()=>{
 const f=fixture();let result='';
 const stop=startInitialGps(f.geolocation,{onSuccess:()=>result='success',onError:()=>result='error'},f.clock);
 stop();
 f.calls[0].success({timestamp:123});
 assert.equal(result,'');
 assert.equal(f.scheduled.size,0);
});
test('permissão negada termina em erro específico, sem novo prompt automático',()=>{
 const f=fixture();let reason='';
 startInitialGps(f.geolocation,{onSuccess:()=>{},onError:e=>reason=gpsErrorText(e)},f.clock);
 f.calls[0].error({code:1,message:'Denied'});
 assert.match(reason,/bloqueada/);
 assert.match(reason,/Chrome/);
 assert.equal(f.calls.length,1);
});
test('indisponibilidade e timeout diferenciam os problemas no Android',()=>{
 assert.match(gpsErrorText({code:2}),/não conseguiu determinar/);
 assert.match(gpsErrorText({code:3}),/demorou/);
});
test('exceção do provedor não deixa a tela esperando para sempre',()=>{
 let received;
 const geolocation={getCurrentPosition(){throw Error('Provider unavailable');}};
 const f=fixture();
 startInitialGps(geolocation,{onSuccess:()=>{},onError:e=>received=e},f.clock);
 assert.equal(received.code,0);
 assert.equal(f.scheduled.size,0);
});
test('o botão principal ativa geolocalização antes de qualquer await/fetch',()=>{
 const source=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
 const from=source.indexOf('const startSharing=()=>{');
 const until=source.indexOf('\n\n const mapped=',from);
 assert.ok(from>=0&&until>from);
 const handler=source.slice(from,until);
 assert.ok(handler.indexOf('startInitialGps(navigator.geolocation')>0);
 assert.ok(handler.indexOf('startInitialGps(navigator.geolocation')<handler.indexOf('await savePrefs(true,true)') );
 assert.match(source,/Cancelar busca de localização/);
 assert.match(source,/gpsActivatingRef\.current/);
});
