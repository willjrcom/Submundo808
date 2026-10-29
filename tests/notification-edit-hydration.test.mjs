import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-engagement.tsx',import.meta.url),'utf8');
test('editor de notificação recupera campos persistidos ao abrir modelo',()=>{
 for(const field of ['setEventId(n.event_id','setTitle(n.title)','setMessage(n.body)','setKind(n.kind)','setTargetKind(n.target_kind)','setTargetId(n.target_id','setAudience(n.audience)']){
  assert.ok(source.includes(field),'É necessário recuperar o campo '+field);
 }
});
test('pontos de notificações podem ser recuperados mesmo se o evento ainda é rascunho',()=>{
 assert.match(source,/request\('events'\)/);
 assert.match(source,/request\('markers\?map_id='\+encodeURIComponent\(id\)\)/);
 assert.doesNotMatch(source,/fetch\('\/api\/public\/events'\)/);
 assert.match(source,/Ponto salvo anteriormente \(indisponível nesta planta\)/);
});
