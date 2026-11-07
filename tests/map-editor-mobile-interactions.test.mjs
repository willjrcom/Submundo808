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
test('clique no plano cartesiano vazio desseleciona sem afetar pontos, ambientes ou controles',()=>{
 assert.match(editor,/const pointerStartedOnEmptyGrid=useRef\(false\)/);
 assert.match(editor,/function trackEmptyGridPointerStart\(e:React\.PointerEvent<HTMLDivElement>\)/);
 assert.match(editor,/pointerStartedOnEmptyGrid\.current=e\.target===pasteboard\.current\|\|e\.target===canvas\.current/);
 assert.match(editor,/function deselectOnEmptyGridClick\(e:React\.MouseEvent<HTMLDivElement>\)/);
 assert.match(editor,/if\(!pointerStartedOnEmptyGrid\.current\|\|frameEditing\)return/);
 assert.match(editor,/if\(e\.target!==pasteboard\.current&&e\.target!==canvas\.current\)return/);
 assert.match(editor,/pointerStartedOnEmptyGrid\.current=false/);
 assert.match(editor,/setSelected\(''\);setResizeId\(null\);setEditLayout\(false\)/);
 assert.match(editor,/setGroupOpen\(false\);setGroupChoice\(''\);setCurveOpen\(false\);setEditMenuOpen\(false\)/);
 assert.match(editor,/ref=\{pasteboard\} onPointerDownCapture=\{trackEmptyGridPointerStart\} onClick=\{deselectOnEmptyGridClick\}/);
 // No parent-page click handlers: only the Cartesian surface handles deselection.
 assert.doesNotMatch(editor,/onClick=\{e=>\{if\(e\.target!==e\.currentTarget\)return;setSelected\(''\)/);
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,a\.id,'area'\)\}/);
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,m\.id,'marker'\)\}/);
 assert.match(editor,/onClick=\{e=>\{e\.stopPropagation\(\);/);
 assert.match(editor,/Clique na área vazia do plano cartesiano para desselecionar/);
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
 assert.match(editor,/Formato do ambiente/);
 assert.doesNotMatch(editor,/absolute right-3 top-3 z-\[60\] flex max-w-\[calc\(100%-24px\)\] flex-wrap gap-2/);
});
test('contorno de foco não permanece no SVG após a desseleção',()=>{
 assert.match(editor,/aria-pressed=\{chosen\} tabIndex=\{frameEditing\?-1:0\}/);
 assert.match(editor,/e\.currentTarget\.blur\(\)/);
 assert.match(editor,/outline:'none'/);
});
