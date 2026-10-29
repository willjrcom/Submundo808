import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');
test('edição de pontos recarrega os detalhes e categorias salvos no mapa',()=>{
 assert.match(workspace,/api\('markers\?map_id='\+encodeURIComponent\(map.id\)\)/);
 assert.match(workspace,/setMarkers\(m.items.map\(normalizeMarker\)\)/);
 for(const item of ['selectedMarker.name','selectedMarker.description','selectedMarker.opens_at','selectedMarker.closes_at','selectedMarker.categories','selectedMarker.size'])assert.ok(workspace.includes(item),'Campo do ponto deve ser recuperado: '+item);
});
test('categorias de ponto salvas continuam visíveis quando deixam de existir no catálogo',()=>{
 assert.match(workspace,/\.\.\.catalogCategories,\.\.\.\(selectedMarker.categories\|\|\[\]\)/);
 assert.match(workspace,/não está mais no catálogo/);
});
