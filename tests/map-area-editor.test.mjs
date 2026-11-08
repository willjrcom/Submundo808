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
 assert.match(editor,/groupOpen&&active&&/);
 assert.doesNotMatch(editor,/groupOpen&&active&&!grouped/);
 assert.match(editor,/grouped&&<button[^\n]*Desagrupar/);
 assert.match(editor,/setGroupOpen\(true\)/);
});
test('grupos continuam aceitando ambientes e Formato permanece acessível',()=>{
 assert.match(editor,/const groupCandidates=active\?visibleRooms\.filter/);
 assert.match(editor,/canGroup\(areas,active\.id,a\.id\)/);
 assert.match(editor,/Parte do grupo para curvar/);
 assert.match(editor,/Não é possível curvar lados que já foram agrupados/);
 assert.match(editor,/disabled=\{!freeCurveSides\.includes\('top'\)\}/);
 assert.match(editor,/disabled=\{grouped\} title=\{grouped\?'O formato oval exige desagrupar/);
 assert.doesNotMatch(editor,/role="menuitem" disabled=\{grouped\}/);
});
test('passagem usa ícone compacto, alvo de toque grande e aparece por borda ou seleção',()=>{
 assert.match(editor,/const \[hoveredPassageEdge,setHoveredPassageEdge\]=useState<string\|null>\(null\)/);
 assert.match(editor,/function trackPassageHover\(e:React\.PointerEvent\)/);
 assert.match(editor,/distance<=9&&along>=edge\.start&&along<=edge\.end/);
 assert.match(editor,/onPointerMove=\{e=>\{move\(e\);trackPassageHover\(e\);\}\}/);
 assert.match(editor,/onPointerLeave=\{\(\)=>setHoveredPassageEdge\(null\)\}/);
 assert.match(editor,/const related=selected===rootAreaId\(edge\.a\)\|\|selected===rootAreaId\(edge\.b\)/);
 assert.match(editor,/const visible=related\|\|hoveredPassageEdge===edgeId/);
 assert.match(editor,/tabIndex=\{visible\?0:-1\}/);
 assert.match(editor,/flex h-11 w-11 -translate-x-1\/2 -translate-y-1\/2 touch-manipulation/);
 assert.match(editor,/flex h-6 w-6 items-center justify-center rounded-full border/);
 assert.match(editor,/<Plus size=\{14\} strokeWidth=\{2\.5\}\/>/);
 assert.match(editor,/if\(already\)return null/);
 assert.match(editor,/createPassage\(edge\.a,edge\.b,edge\.x,edge\.y\)/);
 assert.doesNotMatch(editor,/h-9 w-9 -translate-x-1\/2 -translate-y-1\/2 touch-manipulation/);
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

test('exclusão de ambientes mostra os bloqueios e nunca remove pontos vinculados automaticamente',()=>{
 assert.match(editor,/const deleteGrouped=!!deleteTarget/);
 assert.match(editor,/const deleteLinkedPoints=deleteTarget\?markers\.filter/);
 assert.match(editor,/m\.area_id===deleteTarget\.id\|\|m\.from_area_id===deleteTarget\.id\|\|m\.to_area_id===deleteTarget\.id/);
 assert.match(editor,/const deleteBlocked=deleteGrouped\|\|deleteLinkedPoints\.length>0/);
 assert.match(editor,/if\(item\.kind==='area'&&deleteBlocked\)return/);
 assert.match(editor,/X,AlertTriangle/);
 assert.match(editor,/Não é possível excluir este ambiente/);
 assert.match(editor,/Desagrupe o ambiente antes de excluí-lo/);
 assert.match(editor,/Como resolver:/);
 assert.match(editor,/Não serão apagados ou desvinculados automaticamente/);
 assert.match(editor,/deleteLinkedPoints\.map\(m=>/);
 assert.match(editor,/!deleteBlocked&&<button type="button" onClick=\{confirmDelete\}/);
 assert.doesNotMatch(editor,/setMarkers\(v=>v\.filter\(m=>!\(m\.type==='passagem'&&/);
 assert.match(editor,/> Excluir ambiente<\/button>/);
});
