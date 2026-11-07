import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const route=read('artifacts/submundo-808/src/components/admin-route.ts');
const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
const venue=read('artifacts/submundo-808/src/components/admin-venue-dashboard.tsx');
const event=read('artifacts/submundo-808/src/components/admin-event-dashboard.tsx');
const crowd=read('artifacts/submundo-808/src/components/admin-crowd.tsx');

test('all visible admin statistics labels use the current terminology',()=>{
 for(const [name,source] of [['admin-route',route],['admin-shell',shell],['venue-dashboard',venue],['event-dashboard',event],['crowd-dashboard',crowd]]){
  assert.doesNotMatch(source,/inteligência/iu,'Old visible label in '+name);
 }
 assert.match(shell,/Ver exemplo de estatísticas/);
 assert.match(shell,/Exemplo de estatísticas/);
 assert.match(event,/Ver estatísticas do evento/);
 assert.match(venue,/Ver estatísticas/);
});

test('legacy bookmarks remain valid after renaming the route type',()=>{
 for(const path of ['/intelligence','/inteligencia','/estatisticas','/statistics']){
  assert.deepEqual(parseAdminRoute(path),{section:'Estatísticas',id:null,creating:false});
 }
 assert.equal(adminRoutePath({section:'Estatísticas',id:null,creating:false}),'/statistics');
 assert.match(shell,/section!=='Estatísticas'/);
});
