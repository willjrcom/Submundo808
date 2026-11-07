import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areaPath} from '../artifacts/submundo-808/src/components/map-area-shapes.ts';
const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');

test('curve controls sit above the map without a blocking dialog',()=>{
 assert.match(editor,/aria-label="Controles de curvatura"/);
 assert.match(editor,/ml-auto w-full max-w-xl space-y-3 border-t/);
 assert.doesNotMatch(editor,/curveOpen&&active[^\n]*fixed inset-0/);
 assert.match(editor,/Prévia em tempo real no mapa abaixo/);
});
test('draft updates render live; Apply writes once; Cancel discards draft',()=>{
 assert.match(editor,/const previewAreas=curveOpen&&active/);
 assert.match(editor,/d=\{areaPath\(previewAreas,a\.id\)\}/);
 assert.match(editor,/setCurveDraft\(current=>/);
 assert.match(editor,/onChange=\{e=>updateCurve\(\{depth:Number\(e\.target\.value\)\}\)\}/);
 assert.match(editor,/function applyCurve\(\)/);
 assert.match(editor,/function cancelCurve\(\)/);
 assert.match(editor,/onClick=\{cancelCurve\}/);
});
test('curve draft changes SVG geometry while leaving source room unchanged',()=>{
 const base={id:'lounge',x:10,y:20,width:60,height:40,geometry:{shape:'rect'}};
 const original=areaPath([base],'lounge');
 const draft={...base,geometry:{shape:'rect',curve:{side:'top',direction:'in',depth:25}}};
 const preview=areaPath([draft],'lounge');
 assert.notEqual(preview,original);
 assert.match(preview,/Q/);
 assert.doesNotMatch(original,/Q/);
 assert.equal(base.geometry.curve,undefined);
});

test('single Ambiente action and one format panel offer rectangle, oval and per-side curvature',()=>{
 assert.doesNotMatch(editor,/createRoundArea|Ambiente redondo<\/button>/);
 assert.match(editor,/Oval \/ redondo/);
 assert.match(editor,/Formato e curvatura/);
 assert.match(editor,/aria-label="Borda para curvar"/);
 assert.match(editor,/setFormatSide\(e\.target\.value as CurveSide\)/);
 assert.match(editor,/aria-label="Intensidade da curvatura"/);
 assert.match(editor,/onClick=\{applyCurve\}/);
});
