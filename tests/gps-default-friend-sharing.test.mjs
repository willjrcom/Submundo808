import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePostgresRow} from '../server/postgres-sync.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const server=read('server/index.mjs');
const map=read('artifacts/submundo-808/src/components/venue-map.tsx');
const permissions=read('artifacts/submundo-808/src/components/profile-permissions.tsx');
const offline=read('artifacts/submundo-808/src/components/offline-private-data.ts');
const worker=read('artifacts/submundo-808/public/sw.js');

test('Não compartilhar com amigos é opt-out desmarcado por padrão, salvo na conta',()=>{
 assert.match(permissions,/const \[dontShareWithFriends,setDontShareWithFriends\]=useState\(false\)/);
 assert.match(permissions,/Não compartilhar com amigos/);
 assert.match(permissions,/checked=\{dontShareWithFriends\}/);
 assert.match(permissions,/onChange=\{e=>void updateFriendPrivacy\(e\.target\.checked\)\}/);
 assert.match(permissions,/fetch\('\/api\/location\/share-friends-preference'/);
 assert.match(permissions,/setDontShareWithFriends\(payload\.dontShareWithFriends===true\)/);
 assert.match(permissions,/window\.dispatchEvent\(new CustomEvent\('submundo-friend-sharing-privacy'/);
 assert.match(permissions,/A permissão do Android, sozinha, não inicia o compartilhamento/);
});
test('backend salva a preferência sem alterar por engano o GPS local, e revoga posições ativas imediatamente',()=>{
 assert.match(server,/\['share_friends_disabled','INTEGER NOT NULL DEFAULT 0'\]/);
 assert.match(server,/if\(url\.pathname==='\/api\/location\/share-friends-preference'&&req\.method==='POST'\)/);
 assert.match(server,/typeof b\.disabled!=='boolean'/);
 assert.match(server,/INSERT OR IGNORE INTO location_preferences\(user_id,gps_enabled,share_enabled,updated_at\)/);
 assert.match(server,/UPDATE location_preferences SET share_friends_disabled=1,share_enabled=0/);
 assert.match(server,/DELETE FROM live_locations WHERE user_id=\?/);
 assert.match(server,/UPDATE location_preferences SET share_friends_disabled=0,updated_at=\?/);
 assert.match(server,/dontShareWithFriends:row\?\.share_friends_disabled===1/);
 assert.match(server,/if\(b\.shareEnabled&&db\.prepare\('SELECT share_friends_disabled/);
 assert.match(server,/if\(!pref\?\.share_enabled\|\|pref\.share_friends_disabled\)/);
 assert.equal(normalizePostgresRow({share_friends_disabled:'1'}).share_friends_disabled,1);
 assert.equal(normalizePostgresRow({share_friends_disabled:'0'}).share_friends_disabled,0);
});
test('um botão de GPS acima do mapa, compartilhando por padrão só após toque informado do usuário',()=>{
 const section=map.indexOf('return <section className="space-y-3">');
 const trigger=map.indexOf('onClick={toggleUnifiedGps}',section);
 const drawing=map.indexOf('Mapa do evento</h2>',section);
 assert.ok(section>=0&&trigger>section&&drawing>trigger);
 assert.match(map,/const toggleUnifiedGps=\(\)=>\{/);
 assert.match(map,/if\(!dontShareRef\.current&&navigator\.onLine/);
 assert.match(map,/startSharing\(\)/);
 assert.match(map,/toggleLocalPosition\(\)/);
 assert.match(map,/Ao ativar o GPS, sua posição também fica visível aos amigos/);
 assert.match(map,/\{gpsActive\?'Parar GPS':'Ativar GPS'\}/);
 assert.doesNotMatch(map,/Localização com amigos<\/h3>/);
 assert.doesNotMatch(map,/Minha posição na planta/);
});
test('duração e grupos permanecem num modal, o fluxo não pede confirmação duplicada',()=>{
 assert.match(map,/role="dialog" aria-modal="true" aria-label="Configurações de localização"/);
 assert.match(map,/onClick=\{\(\)=>setLocationSetupOpen\(true\)\}/);
 assert.match(map,/Por quanto tempo compartilhar\?/);
 assert.match(map,/Até o fim da festa/);
 assert.match(map,/Por 4 horas/);
 assert.match(map,/Por 1 hora/);
 assert.match(map,/Compartilhar também com meus grupos/);
 assert.match(map,/Salvar configurações/);
 assert.doesNotMatch(map,/Confirmar e ativar/);
});
test('opt-out remove só compartilhamento, mantém GPS e bloqueia novos envios até reautorização',()=>{
 assert.match(map,/const onPrivacyChange=\(event:Event\)=>\{/);
 assert.match(map,/shareEpoch\.current\+\+;sharingRef\.current=false;setSharing\(false\)/);
 assert.match(map,/dontShareRef\.current=disabled;setDontShareWithFriends\(disabled\)/);
 assert.match(map,/if\(disabled\)\{/);
 assert.match(map,/if\(dontShareRef\.current\|\|sharingRef\.current\|\|!navigator\.onLine/);
 assert.match(server,/share_friends_disabled/);
 assert.match(map,/sendLatestLocation\(\)/);
});
test('GPS local aparece antes da resposta da API e dados offline não esperam localização de amigos',()=>{
 const callback=map.indexOf('const onGpsSuccess='),render=map.indexOf('consumeGpsPosition(position);',callback);
 const prefs=map.indexOf('await savePrefs(true,true,shareMode,activeEventId)',callback);
 assert.ok(callback>=0&&render>callback&&prefs>render);
 assert.match(map,/setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
 assert.match(map,/const showLoading=useMinimumLoading\(!!activeEventId&&\(!mapsReady\|\|loadedForEventId!==activeEventId\|\|!mapResolved\)\)/);
 assert.doesNotMatch(map,/!mapResolved\|\|!prefsReady\|\|!friendsReady/);
 assert.match(map,/GPS parado\. A desativação no servidor será sincronizada/);
 // Already 3.2 seconds for public cache and 4.5 seconds for private cache.
 assert.match(worker,/timeoutMs=3200/);
 assert.match(offline,/setTimeout\(\(\)=>controller\.abort\(\),4500\)/);
});
