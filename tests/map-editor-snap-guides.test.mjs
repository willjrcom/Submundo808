import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');

test('moving a room displays magnetic guides for map and neighbouring boundaries',()=>{
 assert.match(editor,/const \[snapGuide,setSnapGuide\]/);
 assert.match(editor,/const updated=moveAreaGroup\(d\.snapshot\.areas,d\.id/);
 assert.match(editor,/const targetsX=\[0,100,\.\.\.others\.flatMap/);
 assert.match(editor,/const targetsY=\[0,100,\.\.\.others\.flatMap/);
 assert.match(editor,/snapGuide\?\.x!==undefined/);
 assert.match(editor,/snapGuide\?\.y!==undefined/);
 assert.match(editor,/setSnapGuide\(null\)/);
 assert.match(editor,/checked=\{snap\} onChange=\{e=>setSnap\(e\.target\.checked\)\}/);
});
