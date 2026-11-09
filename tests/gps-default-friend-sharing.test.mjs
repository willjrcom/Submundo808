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

test('o modal de Permissões não contém opt-out de amigos nem autorização individual de Estatísticas',()=>{
 assert.doesNotMatch(permissions,/Não compartilhar com amigos/);
 assert.doesNotMatch(permissions,/Estatísticas anônimas do evento/);
 assert.doesNotMatch(permissions,/toggleCrowdConsent|updateFriendPrivacy|share-friends-preference|analytics-consent/);
 assert.doesNotMatch(permissions,/checked=\{dontShareWithFriends\}/);
 assert.match(permissions,/const \[locationActive,setLocationActive\]=useState\(false\)/);
 assert.match(permissions,/\(locationActive\|\|localGpsActive\)&&<section aria-label="Sessão de localização ativa"/);
 assert.match(permissions,/Encerrar localização e compartilhamento/);
 assert.match(permissions,/window\.dispatchEvent\(new Event\('submundo-location-stop'\)\)/);
 assert.match(permissions,/localStorage\.setItem\('submundo-gps-stop-pending','1'\)/);
 assert.match(permissions,/fetch\('\/api\/location\/stop'/);
 assert.match(permissions,/Sua posição só será compartilhada quando você tocar em Ativar GPS e compartilhar/);
});

test('compartilhamento e Estatísticas só começam no novo toque informado do usuário',()=>{
 const section=map.indexOf('return <section className="space-y-3">');
 const trigger=map.indexOf('onClick={sharing?resumeSavedGps:hasLocalGpsIntent(activeEventId)||gpsSessionError?toggleLocalPosition:toggleUnifiedGps}',section);
 const drawing=map.indexOf('Mapa do evento</h2>',section);
 assert.ok(section>=0&&trigger>section&&drawing>trigger);
 assert.match(map,/const toggleUnifiedGps=\(\)=>\{/);
 assert.match(map,/const unifiedActivationPending=useRef\(false\)/);
 assert.match(map,/unifiedActivationPending\.current=true/);
 assert.match(map,/privacyRevision\.current\+\+/);
 assert.match(map,/statisticsRevision\.current\+\+/);
 assert.match(map,/statisticsEnabledRef\.current=true;statisticsEventRef\.current=activeEventId/);
 assert.match(map,/await savePrefs\(true,true,activeEventId,true,unifiedActivationPending\.current\)/);
 assert.match(map,/analyticsEnabled:shareEnabled&&statisticsEnabled/);
 assert.match(map,/unifiedActivation:shareEnabled&&unifiedActivation/);
 assert.match(map,/mode:'event'/);
 assert.match(map,/Ativar e compartilhar/);
 assert.match(map,/hasLocalGpsIntent\(activeEventId\)/);
 assert.match(map,/\{!gpsSessionChecking&&!tracking&&!location&&!localGpsEnabled&&!gpsStarting&&watch.current===null/);
 assert.doesNotMatch(map,/Configurações de localização|Configurar localização|locationSetupOpen/);
 assert.doesNotMatch(map,/Por quanto tempo compartilhar\?|Por 4 horas|Por 1 hora|Salvar configurações/);
});

test('preferência antiga não vira consentimento automático em segundo plano',()=>{
 assert.match(server,/\['share_friends_disabled','INTEGER NOT NULL DEFAULT 0'\]/);
 assert.match(server,/if\(b\.shareEnabled&&b\.unifiedActivation!==true&&/);
 assert.match(server,/b\.unifiedActivation===true&&\(!b\.shareEnabled\|\|b\.analyticsEnabled!==true\)/);
 assert.match(server,/UPDATE location_preferences SET share_friends_disabled=0 WHERE user_id=\?/);
 assert.match(server,/if\(b\.shareEnabled&&b\.unifiedActivation===true\)/);
 assert.match(map,/statisticsRevision\.current===requestedStatisticsRevision/);
 assert.match(map,/privacyRevision\.current===requestedPrivacyRevision/);
 assert.match(map,/await savePrefs\(true,true,activeEventId,statisticsEnabledRef\.current&&statisticsEventRef\.current===activeEventId,unifiedActivationPending\.current\)/);
 assert.match(map,/unifiedActivationPending\.current=false/);
 assert.equal(normalizePostgresRow({share_friends_disabled:'1'}).share_friends_disabled,1);
});

test('o usuário consegue encerrar o GPS, interromper os envios e sincronizar offline',()=>{
 assert.match(permissions,/const stopLocationSession=async\(\)=>|async function stopLocationSession\(\)/);
 assert.match(permissions,/shareEnabled:false,analyticsEnabled:false,shareWithGroups:false/);
 assert.match(map,/const stopSharing=async\(\)=>/);
 assert.match(map,/window\.addEventListener\('submundo-location-stop',onStopLocation\)/);
 assert.match(map,/window\.addEventListener\('storage',onStorage\)/);
 assert.match(map,/const autoShareSuppressed=useRef\(false\)/);
 assert.match(map,/autoShareSuppressed\.current=true/);
 assert.match(map,/if\(localStorage\.getItem\('submundo-gps-stop-pending'\)==='1'\)/);
 assert.match(map,/GPS parado\. A desativação no servidor será sincronizada/);
 assert.match(server,/DELETE FROM live_locations WHERE user_id=\?/);
 assert.match(server,/if\s*\(url\.pathname==='\/api\/location\/stop'/);
});

test('o GPS local continua possível em eventos sem compartilhamento e antes da conexão',()=>{
 assert.match(map,/startSharing\(\)/);
 assert.match(map,/toggleLocalPosition\(\)/);
 assert.match(map,/activeEvent\?\.location_sharing_enabled!==1/);
 assert.match(map,/localGpsWatch\.current!==null/);
 assert.match(map,/if\(autoShareSuppressed\.current\|\|dontShareRef\.current/);
});

test('GPS local aparece antes da resposta da API e dados offline não esperam localização de amigos',()=>{
 const callback=map.indexOf('const onGpsSuccess='),render=map.indexOf('consumeGpsPosition(position);',callback);
 const prefs=map.indexOf('await savePrefs(true,true,activeEventId,true,unifiedActivationPending.current)',callback);
 assert.ok(callback>=0&&render>callback&&prefs>render);
 assert.match(map,/setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
 assert.match(map,/const showLoading=useMinimumLoading\(!!activeEventId&&\(!mapsReady\|\|loadedForEventId!==activeEventId\|\|!mapResolved\)\)/);
 assert.doesNotMatch(map,/!mapResolved\|\|!prefsReady\|\|!friendsReady/);
 assert.match(map,/GPS parado\. A desativação no servidor será sincronizada/);
 // Already 3.2 seconds for public cache and 4.5 seconds for private cache.
 assert.match(worker,/timeoutMs=3200/);
 assert.match(offline,/setTimeout\(\(\)=>controller\.abort\(\),4500\)/);
});

test('mapa diferencia GPS local de posição realmente recebida pelo servidor',()=>{
 const map=read('artifacts/submundo-808/src/components/venue-map.tsx');
 assert.match(map,/requestLocation\('me'\)/);
 assert.match(map,/setServerSharing\(result.sharing===true\)/);
 assert.match(map,/setServerSharing\(true\)/);
 assert.doesNotMatch(map,/Estado do compartilhamento de localização/);
 assert.doesNotMatch(map,/O painel conta somente localizações recebidas pelo servidor/);
 assert.match(map,/O servidor não iniciou o compartilhamento:/);
 const dashboard=read('artifacts/submundo-808/src/components/admin-usage.tsx');
 assert.match(dashboard,/nos últimos 90 segundos/);
});

test('refresh restaura a sessão sem novo consentimento, sem falsificar confirmação do servidor',()=>{
 assert.match(map,/const \[gpsSessionChecking,setGpsSessionChecking\]=useState\(true\)/);
 assert.match(map,/const restoreSharing=\(\)=>\{/);
 assert.match(map,/requestLocation\('preferences'\)/);
 assert.match(map,/if\(p.shareEnabled&&!dontShareRef.current&&!stopPending&&!autoShareSuppressed.current\)/);
 assert.match(map,/sharingRef.current=true;setSharing\(true\);setServerSharing\(null\)/);
 assert.match(map,/void checkPermission\(\)/);
 assert.match(map,/if\(status.state==='granted'\)/);
 assert.match(map,/if\(watch.current===null&&!gpsActivatingRef.current\)startGps\(\)/);
 assert.match(map,/!gpsSessionChecking&&!tracking&&!location&&!localGpsEnabled/);
 assert.doesNotMatch(map,/Verificando sessão\.\.\.'|Verificando se o compartilhamento anterior continua válido/);
 assert.match(map,/sharing\?resumeSavedGps:hasLocalGpsIntent\(activeEventId\)\|\|gpsSessionError\?toggleLocalPosition:toggleUnifiedGps/);
 assert.match(map,/const resumeSavedGps=\(\)=>\{/);
 assert.match(map,/setGpsSessionError\(''\);startGps\(\)/);
 assert.match(map,/return resumeLocalGpsIfAllowed\(\)/);
 assert.match(map,/window.removeEventListener\('online',retryRestoreOnOnline\)/);
});
test('sem evento selecionado o reload não revoga compartilhamento existente',()=>{
 assert.match(map,/if\(!activeEventRef.current\)\{/);
 assert.match(map,/Sem evento selecionado, não iniciar o GPS/);
 assert.match(map,/else if\(p.eventId!==activeEventRef.current\)\{/);
 assert.match(map,/localStorage.getItem\('submundo-gps-stop-pending'\)/);
});
test('GPS persistido oculta os avisos no topo e não reinicia compartilhamento expirado',()=>{
 assert.match(map,/const GPS_LOCAL_INTENT_KEY='submundo-gps-local-enabled-event-v1'/);
 assert.match(map,/rememberLocalGpsIntent\(activeEventRef.current\)/);
 assert.match(map,/hasLocalGpsIntent\(eventId\)/);
 assert.match(map,/const resumeLocalGpsIfAllowed=async\(\)=>\{/);
 assert.match(map,/permission\?\.state!=='granted'/);
 assert.match(map,/autoShareSuppressed\.current=true;\s*toggleLocalPosition\(\)/);
 assert.match(map,/else if\(!stopPending\)\{[\s\S]*?return resumeLocalGpsIfAllowed\(\)/);
 assert.match(map,/\{!gpsSessionChecking&&!tracking&&!location&&!localGpsEnabled&&!gpsStarting&&watch.current===null/);
 assert.doesNotMatch(map,/Estado do compartilhamento de localização/);
 assert.doesNotMatch(map,/O painel conta somente localizações recebidas pelo servidor/);
 assert.match(map,/forgetLocalGpsIntent\(\)/);
 assert.match(permissions,/localStorage.removeItem\('submundo-gps-local-enabled-event-v1'\)/);
});