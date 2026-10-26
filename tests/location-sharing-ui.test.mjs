import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const frontend=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('o mapa oferece as três opções na ordem correta, com fim da festa como padrão',()=>{
 assert.match(frontend,/type ShareMode='event'\|'4h'\|'1h'/);
 assert.match(frontend,/useState<ShareMode>\('event'\)/);
 const eventIndex=frontend.indexOf("value:'event',title:'Até o fim da festa'");
 const fourHours=frontend.indexOf("value:'4h',title:'Por 4 horas'");
 const oneHour=frontend.indexOf("value:'1h',title:'Por 1 hora'");
 assert.ok(eventIndex>0&&fourHours>eventIndex&&oneHour>fourHours);
 assert.doesNotMatch(frontend,/Intervalo desejado entre atualizações/);
});
test('opção até o fim usa o evento atualmente selecionado',()=>{
 assert.match(frontend,/activeEventId/);
 assert.match(frontend,/const eventForSharing=activeEvent/);
 assert.match(frontend,/savePrefs\(true,true,shareMode,activeEventId\)/);
 assert.match(frontend,/if\(!sharingRef\.current&&!activeEventId\)/);
});
test('seleção permanece estável durante o compartilhamento e restaura o prazo salvo',()=>{
 assert.match(frontend,/\{locationSetupOpen&&!sharing&&<div/);
 assert.match(frontend,/setLocationSetupOpen\(true\)/);
 assert.match(frontend,/setLocationSetupOpen\(false\)/);
 assert.match(frontend,/setShareMode\(p\.mode==='4h'\|\|p\.mode==='1h'\?p\.mode:'event'\)/);
 assert.match(frontend,/setSharingExpiresAt\(p\.expiresAt\|\|null\)/);
 assert.match(frontend,/Compartilhando até \{sharingDeadline\}/);
});
test('GPS é interrompido quando o prazo vence localmente ou o servidor rejeita atualização',()=>{
 assert.match(frontend,/Date\.now\(\)>=sharingExpiresAt/);
 assert.match(frontend,/endLocalSharing\('O compartilhamento terminou no horário escolhido\.'\)/);
 assert.match(frontend,/status\?:number\}\)\.status===410/);
 assert.match(frontend,/navigator\.geolocation\.clearWatch\(watch\.current\)/);
});
test('prazo é definido pelo backend, com expiração em updates e lista de amigos',()=>{
 assert.match(backend,/resolveSharingExpiry\(db,\{mode:b\.mode,eventId:b\.eventId,now\}\)/);
 assert.match(backend,/share_expires_at/);
 assert.match(backend,/expireLocationShares\(db,now\)/);
 assert.match(backend,/p\.share_expires_at>\?/);
 assert.match(backend,/return json\(res,410,/);
});
test('desligar manualmente apaga localização e encerra o prazo',()=>{
 assert.match(frontend,/await savePrefs\(false,false\)/);
 assert.match(backend,/if\(!b\.shareEnabled\)db\.prepare\('DELETE FROM live_locations WHERE user_id=\?'\)/);
 assert.match(backend,/share_expires_at=NULL,share_event_id=NULL/);
});

test('o mapa permanece visível antes de pedir o prazo e o GPS só começa na confirmação',()=>{
 assert.match(frontend,/locationSetupOpen&&!sharing/);
 assert.match(frontend,/Confirmar e ativar/);
 assert.match(frontend,/onClick=\{startSharing\}/);
 assert.match(frontend,/onClick=\{\(\)=>\{if\(gpsStarting\)cancelGpsStartup\(\);else if\(gpsActive\)void stopSharing\(\);else if\(sharing\)startSharing\(\);else setLocationSetupOpen\(true\);\}\}/);
 assert.doesNotMatch(frontend,/aria-label="Escolher evento do mapa"/);
});

test('friends on the map are filtered by festival even for 1h or 4h sharing',()=>{
 assert.match(frontend,/friends\?event_id='\+encodeURIComponent\(eventId\)/);
 assert.match(frontend,/p\.eventId!==activeEventRef\.current/);
 assert.match(backend,/p\.share_event_id=\?/);
 assert.match(backend,/b\.shareEnabled\?b\.eventId:null/);
});
