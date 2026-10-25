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
 assert.match(frontend,/localStorage\.getItem\('submundo-event-id'\)/);
 assert.match(frontend,/setSelectedEventId\(event\?\.id\|\|''\)/);
 assert.match(frontend,/savePrefs\(true,true,shareMode,shareMode==='event'\?selectedEventId:null\)/);
 assert.match(frontend,/if\(!sharingRef\.current&&shareMode==='event'&&!selectedEventId\)/);
});
test('seleção permanece estável durante o compartilhamento e restaura o prazo salvo',()=>{
 assert.match(frontend,/fieldset disabled=\{sharing\|\|gpsStarting\|\|prefsSaving\}/);
 assert.match(frontend,/setShareMode\(p\.mode==='4h'\|\|p\.mode==='1h'\?p\.mode:'event'\)/);
 assert.match(frontend,/setSharingExpiresAt\(p\.expiresAt\|\|null\)/);
 assert.match(frontend,/Compartilhamento ativo até \{sharingDeadline\}/);
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
