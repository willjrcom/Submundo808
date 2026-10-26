import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');
const participant=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('marker coordinates denote the icon center, never its combined label box',()=>{
 for(const source of [editor,participant]){
  assert.match(source,/const labelPosition=side==='bottom'/);
  assert.match(source,/absolute z-10 -translate-x-1\/2 -translate-y-1\/2/);
  assert.match(source,/style=\{\{left:m\.x\+'%',top:m\.y\+'%',width:size,height:size\}\}/);
  assert.match(source,/pointer-events-none absolute z-20 w-max max-w-24/);
  assert.doesNotMatch(source,/const shift=side==='top'/);
 }
});
test('the label moves around the icon instead of offsetting it from the border',()=>{
 for(const source of [editor,participant]){
  assert.match(source,/bottom-full left-1\/2 -translate-x-1\/2 mb-1/);
  assert.match(source,/left-full top-1\/2 -translate-y-1\/2 ml-1/);
  assert.match(source,/right-full top-1\/2 -translate-y-1\/2 mr-1/);
  assert.match(source,/top-full left-1\/2 -translate-x-1\/2 mt-1/);
 }
});
test('public map leaves padding and does not clip the icon outside its edge',()=>{
 assert.match(participant,/overflow-visible rounded-2xl border border-white\/15 bg-\[#17111d\] p-6/);
 assert.match(participant,/overflow-visible rounded-xl border border-white\/20 bg-\[#0e0c14\]/);
});
test('unchanged marker drag and save still use the same coordinate',()=>{
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,m\.id,'marker'\)\}/);
 assert.match(editor,/moveMarker\(m,p\.x-d\.offsetX,p\.y-d\.offsetY\)/);
 assert.match(editor,/api\('save-layout',\{map_id:map\.id,areas,markers,frame\}\)/);
});
