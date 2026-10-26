import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');

test('deleting a room or marker opens a branded confirmation instead of window.confirm',()=>{
 assert.doesNotMatch(editor,/window\.confirm\('Remover /);
 assert.match(editor,/setPendingDelete\(item\)/);
 assert.match(editor,/role="alertdialog"/);
 assert.match(editor,/aria-modal="true"/);
 assert.match(editor,/Excluir \{pendingDelete\.kind==='area'\?'ambiente':'ponto'\}/);
 assert.match(editor,/id="confirm-remove-description"/);
 assert.match(editor,/Salvar mapa/);
});
test('cancel, Escape and backdrop dismiss without deleting',()=>{
 assert.match(editor,/if\(event\.key==='Escape'&&pendingDelete\)/);
 assert.match(editor,/onClick=\{\(\)=>setPendingDelete\(null\)\}/);
 assert.match(editor,/if\(event\.target===event\.currentTarget\)setPendingDelete\(null\)/);
 assert.match(editor,/autoFocus onClick=\{\(\)=>setPendingDelete\(null\)\}/);
});
test('confirm removes correct pending item, keeps undo history and requires Save',()=>{
 assert.match(editor,/function confirmDelete\(\)/);
 assert.match(editor,/checkpoint\(\);\s*if\(item\.kind==='area'\)/);
 assert.match(editor,/v=>v\.filter\(a=>a\.id!==item\.id\)/);
 assert.match(editor,/v=>v\.filter\(m=>m\.id!==item\.id\)/);
 assert.match(editor,/onClick=\{confirmDelete\}/);
});
test('any marker can be placed freely or anchored; only entrance requires border',()=>{
 assert.match(editor,/aria-pressed=\{!selectedMarker\.anchor\}/);
 assert.match(editor,/disabled=\{selectedMarker\.type==='entrada'\}/);
 assert.match(editor,/closestMapEdge\(selectedMarker\.x,selectedMarker\.y\)\.side/);
 assert.match(editor,/MAP_SIDES\.map\(side=>/);
 assert.match(editor,/moveMarker\(m,p\.x-d\.offsetX,p\.y-d\.offsetY\)/);
 assert.doesNotMatch(editor,/\(selectedMarker\.type==='palco'\|\|selectedMarker\.type==='entrada'\)&&<div/);
});
