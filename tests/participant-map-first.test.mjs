import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+path,import.meta.url),'utf8');
const map=read('venue-map.tsx');
const perms=read('profile-permissions.tsx');

test('o mapa e seus pontos aparecem antes dos controles de localização e orientação',()=>{
 const root=map.indexOf('return <section className="space-y-3">');
 const title=map.indexOf('Mapa do evento</h2>',root);
 const canvas=map.indexOf('ref={setMapElement}',title);
 const sharing=map.indexOf('Localização com amigos</h3>',root);
 const outside=map.indexOf('aria-label="Orientação até o evento"',root);
 assert.ok(root>=0&&title>root&&canvas>title,'mapa renderizado');
 assert.ok(sharing>canvas,'controles de compartilhamento devem ficar depois da planta');
 assert.ok(outside>canvas,'orientação deve ser mostrada depois da planta');
 assert.match(map,/bg-\[#17111d\] p-3 sm:p-5/);
 assert.match(map,/text-xl font-black uppercase">Mapa do evento/);
});
test('informações de localização são compactas, mas deixam direção e desativação acessíveis',()=>{
 assert.match(map,/rounded-xl border border-\[#c4ff40\]\/20 bg-\[#c4ff40\]\/\[\.035\] px-3 py-2\.5/);
 assert.match(map,/Localização com amigos/);
 assert.match(map,/Até \{sharingDeadline\}/);
 assert.match(map,/gpsActive\?'Desativar localização'/);
 assert.match(map,/Como chegar à entrada/);
 assert.match(map,/em linha reta/);
 assert.match(map,/Desativar compartilhamento/);
 assert.doesNotMatch(map,/className="space-y-3 rounded-2xl border border-\[#c4ff40\]\/35 bg-\[#211a29\] p-4"/);
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
