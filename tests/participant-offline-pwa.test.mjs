import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sw=read('artifacts/submundo-808/public/sw.js');
const offline=read('artifacts/submundo-808/src/components/participant-offline.ts');
const map=read('artifacts/submundo-808/src/components/venue-map.tsx');
const app=read('artifacts/submundo-808/src/App.tsx');
const build=read('artifacts/submundo-808/scripts/build-offline-precache.mjs');
const pkg=JSON.parse(read('artifacts/submundo-808/package.json'));
test('PWA build generates an asset manifest after Vite completes',()=>{
 assert.match(pkg.scripts.build,/vite build.*&& node scripts\/build-offline-precache.mjs/);
 assert.match(build,/readdir/);
 assert.match(build,/\.\/index\.html/);
 assert.match(build,/offline-assets\.json/);
 assert.match(sw,/offline-assets\.json/);
 assert.match(sw,/async function precacheShell/);
 assert.match(sw,/event\.waitUntil\(precacheShell/);
 assert.match(sw,/PRECACHE_PARTICIPANT/);
});
test('service worker uses cache fallback for navigation and public map JSON only',()=>{
 assert.match(sw,/request\.mode==='navigate'/);
 assert.match(sw,/cache\.match\(cacheKey\)/);
 assert.match(sw,/if\(url\.href===ROOT&&response\.ok\)await safePut\(cache,ROOT,response\)/);
 assert.match(sw,/return \(await cache\.match\(ROOT\)\)\|\|/);
 assert.doesNotMatch(sw,/networkFirst\(request,SHELL,ROOT/);
 assert.match(sw,/if\(url\.pathname\.startsWith\('\/api'\)\)/);
 assert.match(sw,/if\(!isPublicApi\(url\)\)return/);
 assert.doesNotMatch(sw,/api\/auth\/me|\/api\/groups\/detail|\/api\/location\/friends/);
 assert.match(sw,/allowedPublic=new Set\(\['events','maps','map-detail','menu','branding','event-settings'\]\)/);
});
test('offline warmup saves event details, map geometries, menus and schedule',()=>{
 assert.match(offline,/PARTICIPANT_PUBLIC_CACHE='submundo-808-public-v1'/);
 assert.match(offline,/cachePublicJson\('\/api\/public\/'\+key\)/);
 assert.match(offline,/\/api\/public\/map-detail\?map_id=/);
 assert.match(offline,/\/api\/public\/menu\?event_id=/);
 assert.match(offline,/cache\.put\(request,response\.clone\(\)\)/);
 assert.match(offline,/if\(cached\)return cached\.json\(\)/);
 assert.match(offline,/PRECACHE_PARTICIPANT/);
 assert.match(app,/warmParticipantOffline/);
 assert.match(app,/Modo offline · exibindo a última versão baixada do evento/);
});
test('device GPS works offline without enabling live sharing or writing location to API',()=>{
 assert.match(map,/const \[localGpsEnabled,setLocalGpsEnabled\]=useState\(false\)/);
 assert.match(map,/function|const toggleLocalPosition=\(\)=>/);
 assert.match(map,/navigator\.geolocation\.watchPosition/);
 assert.match(map,/consumeGpsPosition\(position\)/);
 assert.match(map,/localGpsWatch\.current!==null/);
 assert.match(map,/localGpsWatch\.current=null/);
 assert.match(map,/Sem leituras recentes de GPS/);
 assert.match(map,/const toggleUnifiedGps=\(\)=>\{/);
 assert.match(map,/!dontShareRef\.current&&navigator\.onLine/);
 assert.match(map,/toggleLocalPosition\(\)/);
 assert.match(map,/O GPS funciona offline/);
 assert.match(map,/const mapped=location&&bounds&&!mapIsDemo\?gpsToMap\(location,bounds\)/);
 assert.match(map,/if\(!sharingRef\.current\|\|!trackingRef\.current\|\|!position\|\|sendBusy\.current\)return/);
 assert.match(map,/aria-label="Sua localização aproximada"/);
});
test('the worker never intercepts private API requests',async()=>{
 const handlers={};
 const scope={
  self:{
   location:{href:'https://submundo.test/sw.js',origin:'https://submundo.test'},
   addEventListener:(name,callback)=>{handlers[name]=callback;},
   skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve()}
  },
  URL,Set,Promise,Response,Request,AbortController,Error,setTimeout,clearTimeout,
  caches:{keys:()=>Promise.resolve([]),open:()=>Promise.resolve({match:()=>Promise.resolve(null),put:()=>Promise.resolve()})},
  fetch:()=>Promise.reject(Error('offline'))
 };
 vm.runInNewContext(sw,scope);
 let intercepted=false;
 handlers.fetch({request:{method:'GET',url:'https://submundo.test/api/groups/preview?token=abc',mode:'cors'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false);
 handlers.fetch({request:{method:'GET',url:'https://submundo.test/api/auth/me',mode:'cors'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false);
 handlers.fetch({request:{method:'GET',url:'https://submundo.test/api/location/friends',mode:'cors'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false);
 let publicIntercepted=false;
 handlers.fetch({request:{method:'GET',url:'https://submundo.test/api/public/map-detail?map_id=map1',mode:'cors'},respondWith:(promise)=>{publicIntercepted=true;void promise.catch(()=>{});}});
 assert.equal(publicIntercepted,true);
});
