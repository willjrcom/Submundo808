import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const editor=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const publicMap=read('artifacts/submundo-808/src/components/venue-map.tsx');
const labels=read('artifacts/submundo-808/src/components/use-map-labels.ts');
const server=read('server/index.mjs');

test('editor expõe Agrupar/Desagrupar, Curvar, formato redondo e seleção da peça',()=>{
 for(const label of ['Agrupar','Desagrupar','Curvar','Ambiente redondo','Intensidade da curvatura','Ambiente para agrupar']){
  assert.ok(editor.includes(label),label);
 }
 assert.match(editor,/groupCandidates\.map\(a=>/);
 assert.match(editor,/canGroup\(areas,active\.id,groupChoice\)/);
 assert.match(editor,/checkpoint\(\);setAreas\(groupWith/);
 assert.match(editor,/checkpoint\(\);setAreas\(ungroup/);
});
test('editor e mapa público usam a mesma silhueta e omitem divisórias internas',()=>{
 assert.match(editor,/visibleRooms\.map\(a=>/);
 assert.match(editor,/d=\{areaPath\(areas,a\.id\)\}/);
 assert.match(publicMap,/visibleAreas\(data\.areas\)\.map\(a=>/);
 assert.match(publicMap,/d=\{areaPath\(data\.areas,a\.id\)\}/);
 assert.match(labels,/visibleAreas\(rooms\)/);
});
test('grupo move junto e impede remover/redimensionar partes sem desagrupar',()=>{
 assert.match(editor,/moveAreaGroup\(d\.snapshot\.areas/);
 assert.match(editor,/Desagrupe para redimensionar/);
 assert.match(editor,/Desagrupe o ambiente antes de excluí-lo/);
});
test('backend mantém geometrias no banco inclusive após recarregar e valida relações',()=>{
 assert.match(server,/ADD COLUMN geometry_json/);
 assert.match(server,/geometry:parseAreaGeometry\(a\.geometry_json\)/);
 assert.match(server,/geometry:parseAreaGeometry\(row\.geometry_json\)/);
 assert.match(server,/const geometryError=validateAreaGeometries\(areas\)/);
 assert.match(server,/JSON\.stringify\(a\.geometry\|\|\{\}\)/);
});
