import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const editor=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const marker=read('artifacts/submundo-808/src/components/map-marker-geometry.ts');
const css=read('artifacts/submundo-808/src/index.css');
const participant=read('artifacts/submundo-808/src/components/venue-map.tsx');

test('a single tap toggles a selected room or point without pointerdown selection',()=>{
 assert.match(editor,/function toggleSelection\(id:string\)/);
 assert.match(editor,/setSelected\(selected===id\?'':id\)/);
 assert.match(editor,/if\(selected!==id\)return;/);
 assert.match(editor,/toggleSelection\(a\.id\)/);
 assert.match(editor,/toggleSelection\(m\.id\)/);
 assert.doesNotMatch(editor,/if\(selected!==id\)\{setSelected\(id\)/);
});
test('pointer capture does not flip selection after a drag',()=>{
 assert.match(editor,/skipClickAfterDrag\.current=true/);
 assert.match(editor,/!previous\.changed\)toggleSelection\(previous\.id\)/);
});
test('phone-sized map icons render smaller without persisting a different size',()=>{
 assert.match(marker,/var\(--submundo-map-marker-scale, 1\)/);
 assert.match(css,/@media \(max-width: 639px\)/);
 assert.match(css,/--submundo-map-marker-scale: \.72/);
 assert.match(editor,/style=\{markerIconStyle\(m,size\)\}/);
 assert.match(participant,/style=\{markerIconStyle\(m,size\)\}/);
});

test('menu único Editar substitui os botões contextuais e fecha ao desselecionar',()=>{
 assert.match(editor,/aria-haspopup="menu" aria-expanded=\{editMenuOpen\}/);
 assert.match(editor,/role="menu" aria-label=\{'Editar '\+active\.name\}/);
 assert.match(editor,/setSelected\(selected===id\?'':id\)/);
 assert.match(editor,/setEditMenuOpen\(false\)/);
 assert.match(editor,/Desagrupar/);
 assert.match(editor,/Curvar ambiente/);
 assert.doesNotMatch(editor,/absolute right-3 top-3 z-\[60\] flex max-w-\[calc\(100%-24px\)\] flex-wrap gap-2/);
});
test('contorno de foco não permanece no SVG após a desseleção',()=>{
 assert.match(editor,/aria-pressed=\{chosen\} tabIndex=\{frameEditing\?-1:0\}/);
 assert.match(editor,/e\.currentTarget\.blur\(\)/);
 assert.match(editor,/outline:'none'/);
});
