import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+path,import.meta.url),'utf8');
const map=read('venue-map.tsx');
const perms=read('profile-permissions.tsx');

test('o botão único de GPS aparece no início e o mapa permanece visível',()=>{
 const root=map.indexOf('return <section className="space-y-3">');
 const gps=map.indexOf('aria-label="Controles de GPS"',root);
 const title=map.indexOf('Mapa do evento</h2>',root);
 const canvas=map.indexOf('ref={setMapElement}',title);
 const outside=map.indexOf('aria-label="Orientação até o evento"',root);
 assert.ok(root>=0&&gps>root&&title>gps&&canvas>title&&outside>canvas);
 assert.match(map,/text-xl font-black uppercase">Mapa do evento/);
 assert.match(map,/onClick=\{toggleUnifiedGps\}/);
 assert.match(map,/role="dialog" aria-modal="true" aria-label="Configurações de localização"/);
 assert.match(map,/Por quanto tempo compartilhar\?/);
 assert.match(map,/Compartilhar também com meus grupos/);
 assert.match(map,/Como chegar à entrada/);
 assert.doesNotMatch(map,/Localização com amigos<\/h3>/);
});
test('estatísticas anônimas não aparecem na página do mapa nem na ativação do GPS',()=>{
 assert.doesNotMatch(map,/analyticsConsent|toggleAnalyticsConsent|analyticsBusy/);
 assert.doesNotMatch(map,/Contribuir com estatísticas anônimas da festa/);
 assert.doesNotMatch(map,/Estatísticas anônimas do evento/);
 assert.match(map,/analyticsEnabled:false/);
 assert.match(map,/shareWithGroups:shareEnabled&&shareWithGroups/);
});
test('Perfil → Permissões mostra consentimento agregado opcional, consultado e revogável no servidor',()=>{
 assert.match(perms,/aria-label="Permissão para estatísticas anônimas"/);
 assert.match(perms,/Estatísticas anônimas do evento/);
 assert.match(perms,/fetch\('\/api\/location\/preferences'/);
 assert.match(perms,/fetch\('\/api\/location\/analytics-consent'/);
 assert.match(perms,/credentials:'same-origin'/);
 assert.match(perms,/body:JSON\.stringify\(\{eventId:crowdPrefs\.eventId,enabled:next\}\)/);
 assert.match(perms,/!crowdPrefs\?\.shareEnabled\|\|!crowdPrefs\.eventId/);
 assert.match(perms,/crowdPrefs\?\.analyticsEnabled\?'Revogar':'Autorizar'/);
 assert.match(perms,/sem nomes ou trajetos individuais/);
 assert.match(perms,/Os totais anteriores continuam no histórico/);
 assert.match(perms,/role="alert"/);
});
