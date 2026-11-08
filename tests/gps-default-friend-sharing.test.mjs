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
 assert.match(map,/sua posição será compartilhada com amigos e contribuirá para Estatísticas agregadas/);
 assert.match(map,/Ativar GPS e compartilhar/);
 assert.match(map,/\{\(!tracking\|\|!location\)&&<div/);
 assert.match(map,/analyticsEnabled:shareEnabled&&statisticsEnabled/);
 assert.match(map,/mode:'event'/);
 assert.doesNotMatch(map,/Localização com amigos<\/h3>/);
 assert.doesNotMatch(map,/Minha posição na planta/);
});
test('o mapa oferece apenas um botão de GPS, sem engrenagem ou modal de duração',()=>{
 assert.match(map,/Ativar GPS e compartilhar/);
 assert.match(map,/contribuirá para Estatísticas agregadas até o fim da festa/);
 assert.match(map,/await savePrefs\(true,true,activeEventId,true\)/);
 assert.doesNotMatch(map,/Configurações de localização/);
 assert.doesNotMatch(map,/Configurar localização/);
 assert.doesNotMatch(map,/locationSetupOpen|setLocationSetupOpen/);
 assert.doesNotMatch(map,/Por quanto tempo compartilhar\?|Por 4 horas|Por 1 hora|Salvar configurações/);
 assert.doesNotMatch(map,/Compartilhar também com meus grupos/);
 assert.doesNotMatch(map,/Parar GPS/);
 assert.match(map,/Perfil → Permissões/);
});
test('consentimento de Estatísticas preservado em retomadas, com revogação independente no Perfil',()=>{
 assert.match(map,/statisticsEnabledRef=useRef\(false\)/);
 assert.match(map,/statisticsEventRef=useRef<string\|null>\(null\)/);
 assert.match(map,/statisticsEnabledRef\.current=p\.analyticsEnabled===true/);
 assert.match(map,/await savePrefs\(true,true,activeEventId,true\)/);
 assert.match(map,/await savePrefs\(true,true,activeEventId,statisticsEnabledRef\.current&&statisticsEventRef\.current===activeEventId\)/);
 assert.match(map,/submundo-statistics-consent/);
 assert.match(permissions,/window\.dispatchEvent\(new CustomEvent\('submundo-statistics-consent'/);
 assert.match(permissions,/analytics-consent/);
 assert.match(permissions,/Revogar/);
});
test('opt-out remove só compartilhamento, mantém GPS e bloqueia novos envios até reautorização',()=>{
 assert.match(map,/const onPrivacyChange=\(event:Event\)=>\{/);
 assert.match(map,/shareEpoch\.current\+\+;sharingRef\.current=false;setSharing\(false\)/);
 assert.match(map,/dontShareRef\.current=disabled;setDontShareWithFriends\(disabled\)/);
 assert.match(map,/if\(disabled\)\{/);
 assert.match(map,/if\(autoShareSuppressed\.current\|\|dontShareRef\.current\|\|sharingRef\.current\|\|!navigator\.onLine/);
 assert.match(server,/share_friends_disabled/);
 assert.match(map,/sendLatestLocation\(\)/);
 assert.match(map,/const endFriendShareKeepingGps=\(message:string\)=>\{/);
 assert.match(map,/O compartilhamento terminou\. O GPS local continua ativo/);
});
test('prazo finalizado ou revogação não reativa compartilhamento automaticamente ao reconectar',()=>{
 assert.match(map,/const autoShareSuppressed=useRef\(false\)/);
 assert.match(map,/const endFriendShareKeepingGps=\(message:string\)=>\{/);
 assert.match(map,/autoShareSuppressed\.current=true/);
 assert.match(map,/if\(autoShareSuppressed\.current\|\|dontShareRef\.current/);
 assert.match(map,/const onOnline=\(\)=>\{/);
 assert.match(map,/autoShareSuppressed\.current=false/);
});
test('GPS local aparece antes da resposta da API e dados offline não esperam localização de amigos',()=>{
 const callback=map.indexOf('const onGpsSuccess='),render=map.indexOf('consumeGpsPosition(position);',callback);
 const prefs=map.indexOf('await savePrefs(true,true,activeEventId,true)',callback);
 assert.ok(callback>=0&&render>callback&&prefs>render);
 assert.match(map,/setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
 assert.match(map,/const showLoading=useMinimumLoading\(!!activeEventId&&\(!mapsReady\|\|loadedForEventId!==activeEventId\|\|!mapResolved\)\)/);
 assert.doesNotMatch(map,/!mapResolved\|\|!prefsReady\|\|!friendsReady/);
 assert.match(map,/GPS parado\. A desativação no servidor será sincronizada/);
 // Already 3.2 seconds for public cache and 4.5 seconds for private cache.
 assert.match(worker,/timeoutMs=3200/);
 assert.match(offline,/setTimeout\(\(\)=>controller\.abort\(\),4500\)/);
});
