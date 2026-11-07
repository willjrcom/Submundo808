import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const editor=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const publicMap=read('artifacts/submundo-808/src/components/venue-map.tsx');
const labels=read('artifacts/submundo-808/src/components/use-map-labels.ts');
const server=read('server/index.mjs');

test('editor expõe Agrupar/Desagrupar, formato oval e curvas independentes',()=>{
 for(const label of ['Agrupar','Desagrupar','Formato','Oval / redondo','Intensidade da curvatura','Ambiente para agrupar']){
  assert.ok(editor.includes(label),label);
 }
 assert.doesNotMatch(editor,/createRoundArea|Ambiente redondo<\/button>/);
 assert.match(editor,/groupCandidates\.map\(a=>/);
 assert.match(editor,/canGroup\(areas,active\.id,groupChoice\)/);
 assert.match(editor,/checkpoint\(\);setAreas\(groupWith/);
 assert.match(editor,/checkpoint\(\);setAreas\(ungroup/);
});
test('editor e mapa público usam a mesma silhueta e omitem divisórias internas',()=>{
 assert.match(editor,/visibleRooms\.map\(a=>/);
 assert.match(editor,/d=\{areaPath\(previewAreas,a\.id\)\}/);
 assert.match(publicMap,/visibleAreas\(data\.areas\)\.map\(a=>/);
 assert.match(publicMap,/d=\{areaPath\(data\.areas,a\.id\)\}/);
 assert.match(labels,/visibleAreas\(rooms\)/);
});
test('grupo move junto e permite redimensionar bordas externas de cada parte',()=>{
 assert.match(editor,/moveAreaGroup\(d\.snapshot\.areas/);
 assert.match(editor,/outerResizeHandles\(areas,a\.id\)/);
 assert.match(editor,/resizeOuterGroupEdge\(d\.snapshot\.areas/);
 assert.match(editor,/Desagrupe o ambiente antes de excluí-lo/);
});
test('backend mantém geometrias no banco inclusive após recarregar e valida relações',()=>{
 assert.match(server,/ADD COLUMN geometry_json/);
 assert.match(server,/geometry:parseAreaGeometry\(a\.geometry_json\)/);
 assert.match(server,/geometry:parseAreaGeometry\(row\.geometry_json\)/);
 assert.match(server,/const geometryError=validateAreaGeometries\(areas\)/);
 assert.match(server,/JSON\.stringify\(a\.geometry\|\|\{\}\)/);
});

test('novo ambiente inicia maior respeitando busca por área livre',()=>{
 assert.match(editor,/function createArea\(\)\{[\s\S]*?freeAreaPosition\(areas,30,24\)/);
 assert.match(editor,/Não há espaço livre para um novo ambiente/);
});

test('selected grouped root exposes piece-specific outer handles and no internal handle',()=>{
 assert.match(editor,/outerResizeHandles\(areas,a\.id\)\.map\(handle=>/);
 assert.match(editor,/rootAreaId\(part\)!==selected/);
 assert.match(editor,/resizeId!==selected/);
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,handle\.areaId,'resize',handle\.edge\)\}/);
 assert.match(editor,/resizeOuterGroupEdge\(d\.snapshot\.areas,rootAreaId\(part\),d\.id,d\.edge,delta,snap\)/);
 assert.match(editor,/setResizeId\(active\.id\);setEditLayout\(true\)/);
 assert.doesNotMatch(editor,/canResize=!isGrouped\(areas,a\.id\)/);
});
