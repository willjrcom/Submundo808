import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 POINT_ICON_OPTIONS,defaultPointIconId,isPointIconId,resolvePointIconId,pointIconName
} from '../artifacts/submundo-808/src/components/map-point-icon-catalog.ts';
import {changeMarkerType,normalizeMarker} from '../artifacts/submundo-808/src/components/map-marker-geometry.ts';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const editor=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const picker=read('artifacts/submundo-808/src/components/map-point-icon-select.tsx');
const components=read('artifacts/submundo-808/src/components/map-point-icons.tsx');
const publicMap=read('artifacts/submundo-808/src/components/venue-map.tsx');
const server=read('server/index.mjs');

test('palco displays a microphone by default, rather than the old garage icon',()=>{
 assert.equal(defaultPointIconId('palco'),'microphone');
 assert.equal(resolvePointIconId('palco'),'microphone');
 assert.equal(resolvePointIconId('palco',undefined),'microphone');
 assert.equal(resolvePointIconId('palco','stage'),'stage');
 assert.equal(resolvePointIconId('palco','warehouse'),'warehouse');
 assert.equal(resolvePointIconId('palco','invalid'),'microphone');
 assert.equal(resolvePointIconId('unknown','invalid'),'pin');
 assert.match(components,/microphone:MicVocal/);
 assert.match(components,/stage:Theater/);
});

test('named icons are unique, bounded and all have a renderable icon component',()=>{
 const ids=POINT_ICON_OPTIONS.map(option=>option.id);
 assert.ok(ids.length>=20);
 assert.equal(new Set(ids).size,ids.length);
 for(const option of POINT_ICON_OPTIONS){
  assert.ok(/^[a-z][a-z0-9-]{0,39}$/.test(option.id));
  assert.ok(option.name.trim());
  assert.equal(isPointIconId(option.id),true);
  assert.equal(pointIconName(option.id),option.name);
  assert.match(components,new RegExp('\\b'+option.id+':'));
 }
 assert.equal(isPointIconId('not-a-real-icon'),false);
 assert.equal(isPointIconId(null),false);
});

test('changing an icon cannot change type, anchor, name or product associations',()=>{
 const marker=normalizeMarker({id:'palco',type:'palco',name:'Palco',x:50,y:10,categories:['ingressos']});
 const changed={...marker,icon:'stage'};
 assert.equal(changed.type,'palco');
 assert.equal(changed.name,marker.name);
 assert.deepEqual(changed.categories,marker.categories);
 assert.deepEqual(changed.anchor,marker.anchor);
 assert.equal(resolvePointIconId(changed.type,changed.icon),'stage');
 assert.equal(resolvePointIconId(changed.type,undefined),'microphone');
 const toEntrance=changeMarkerType(changed,'entrada');
 assert.equal(toEntrance.type,'entrada');
 assert.equal(toEntrance.icon,'stage','explicit custom icon survives a semantic type change');
 assert.ok(toEntrance.anchor,'type-specific entrance rules continue to apply');
});

test('point editing provides separate type select and labeled SVG icon dropdown',()=>{
 assert.match(editor,/Tipo do ponto<select aria-label="Tipo do ponto"/);
 assert.match(editor,/<MapPointIconSelect key=\{selectedMarker\.id\} type=\{selectedMarker\.type\} icon=\{selectedMarker\.icon\} onChange=\{icon=>updateMarker\(\{icon\}\)\}/);
 assert.match(picker,/role="combobox"/);
 assert.match(picker,/role="listbox"/);
 assert.match(picker,/role="option"/);
 assert.match(picker,/POINT_ICON_COMPONENTS\[option\.id as PointIconId\]/);
 assert.match(picker,/Ícone exibido no mapa/);
 assert.match(picker,/Automático · /);
 assert.match(picker,/onClick=\{\(\)=>choose\(option\.id\)\}/);
 assert.match(picker,/ArrowDown/);
 assert.match(picker,/Escape/);
 assert.match(picker,/document\.addEventListener\('pointerdown',onOutside\)/);
});

test('editor and participant map both render saved icon override, never change type implicitly',()=>{
 assert.match(editor,/const Icon=pointIconFor\(m\.type,m\.icon\)/);
 assert.match(publicMap,/const Icon=pointIconFor\(m\.type,m\.icon\)/);
 assert.match(editor,/const Icon=pointIconFor\(room\.kind,room\.icon\)/);
 assert.match(publicMap,/const Icon=pointIconFor\(room\.kind,room\.icon\)/);
 assert.match(editor,/type Marker=\{id:string;name:string;type:string;icon\?:string/);
 assert.match(publicMap,/type Marker=\{id:string;name:string;type:string;icon\?:string/);
 assert.match(editor,/api\('save-layout',\{map_id:map\.id,areas,markers,frame\}\)/);
 assert.match(server,/JSON\.stringify\(markers\)/);
 assert.match(server,/m\.icon!==undefined/);
 assert.match(server,/typeof m\.icon!=='string'/);
 assert.match(server,/GET.*?map-detail|map-detail/);
});
