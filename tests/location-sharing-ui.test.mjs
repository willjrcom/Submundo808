import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const frontend=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('a escolha de duração aparece somente após ativar localização',()=>{
 assert.match(frontend,/useState<ShareMode>\('event'\)/);
 assert.match(frontend,/!locationSetupOpen&&<button/);
 assert.match(frontend,/else setLocationSetupOpen\(true\)/);
 assert.match(frontend,/locationSetupOpen&&!sharing/);
 for(const label of ['Até o fim da festa','Por 4 horas','Por 1 hora','Confirmar e ativar'])assert.ok(frontend.includes(label));
 assert.match(frontend,/onClick=\{startSharing\}/);
});
test('os três prazos de compartilhamento pertencem ao único evento ativo',()=>{
 assert.match(frontend,/function VenueMap\(\{activeEventId,onChooseEvent\}/);
 assert.match(frontend,/savePrefs\(true,true,shareMode,activeEventId\)/);
 assert.match(frontend,/setSharingEventId\(p\.eventId\|\|null\)/);
 assert.match(backend,/resolveSharingExpiry\(db,\{mode:b\.mode,eventId:b\.eventId,now\}\)/);
 assert.match(backend,/b\.eventId!==pref\.share_event_id/);
});
test('ao mudar de festa a tela encerra GPS anterior e descarta posições antigas',()=>{
 assert.match(frontend,/const previousEventId=useRef\(activeEventId\)/);
 assert.match(frontend,/endLocalSharing\('Compartilhamento encerrado ao trocar de evento\.'\)/);
 assert.match(frontend,/requestLocation\('stop',\{\}\)/);
 assert.match(frontend,/requestLocation\('friends\?event_id='\+encodeURIComponent\(activeEventId\)\)/);
});
test('amigos de outra festa não aparecem no mapa ativo',()=>{
 assert.match(backend,/p\.share_event_id=\?/);
 assert.match(frontend,/friends\?event_id='\+encodeURIComponent\(eventId\)/);
 assert.match(frontend,/setFriends\(\[\]\)/);
});
test('a expiração continua ocorrendo no servidor mesmo com a aba fechada',()=>{
 assert.match(frontend,/Date\.now\(\)>=sharingExpiresAt/);
 assert.match(frontend,/endLocalSharing\('O compartilhamento terminou no horário escolhido\.'\)/);
 assert.match(frontend,/\[403,409,410\]\.includes/);
 assert.match(backend,/expireLocationShares\(db,now\)/);
 assert.match(backend,/p\.share_expires_at>\?/);
});
test('o compartilhamento pode ser desativado manualmente',()=>{
 assert.match(frontend,/await savePrefs\(false,false\)/);
 assert.match(backend,/if\(!b\.shareEnabled\)db\.prepare\('DELETE FROM live_locations WHERE user_id=\?'\)/);
});

test('admin controla permissão por evento; API e mapa respeitam o bloqueio',()=>{
 const admin=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-editors.tsx',import.meta.url),'utf8');
 assert.match(admin,/Permitir compartilhamento de localização neste evento/);
 assert.match(admin,/location_sharing_enabled:locationSharingEnabled/);
 assert.match(backend,/location_sharing_enabled=1/);
 assert.match(backend,/locationSharingEnabled:false/);
 assert.match(frontend,/Localização de amigos indisponível neste evento/);
 assert.match(frontend,/location_sharing_enabled!==1/);
});
