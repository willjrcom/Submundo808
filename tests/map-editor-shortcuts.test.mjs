import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');
const publicMap=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('Ctrl/Cmd+Z undoes dragging; Ctrl/Cmd+Shift+Z and Ctrl+Y redo',()=>{
 assert.match(editor,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(editor,/key==='z'&&!event\.shiftKey/);
 assert.match(editor,/key==='z'&&event\.shiftKey/);
 assert.match(editor,/key==='y'/);
 assert.match(editor,/event\.preventDefault\(\);undo\(\)/);
 assert.match(editor,/event\.preventDefault\(\);redo\(\)/);
 assert.match(editor,/closest\('input,textarea,select,\[contenteditable="true"\]'\)/);
});
test('Escape, close button and backdrop all close calibration without losing draft edits',()=>{
 assert.match(editor,/event\.key==='Escape'&&calibrationOpen/);
 assert.match(editor,/setCalibrationOpen\(false\)/);
 assert.match(editor,/aria-label="Fechar calibração"/);
 assert.match(editor,/max-h-\[calc\(100dvh-1\.5rem\)\]/);
 assert.match(editor,/if\(e\.target===e\.currentTarget\)setCalibrationOpen\(false\)/);
});
test('stage chooses free versus border, entrance chooses among four edges',()=>{
 assert.match(editor,/Ponto livre/);
 assert.match(editor,/Na borda/);
 assert.match(editor,/selectedMarker\.type==='entrada'/);
 assert.match(editor,/MAP_SIDES\.map/);
 assert.match(editor,/anchorMarker\(selectedMarker,e\.target\.value as MapSide\)/);
 assert.match(editor,/moveMarker\(m,p\.x-d\.offsetX,p\.y-d\.offsetY\)/);
});
test('smart room labels appear in editor and public map without covering markers',()=>{
 assert.match(editor,/useMapLabels\(areas,markers\)/);
 assert.match(editor,/roomLabels\.map\(label=>/);
 assert.match(publicMap,/useMapLabels\(data\?\.areas\|\|EMPTY_AREAS,data\?\.markers\|\|EMPTY_MARKERS\)/);
 assert.match(publicMap,/roomLabels\.map\(label=>/);
 assert.match(publicMap,/\.map\(normalizeMarker\)/);
});
test('server enforces border-only entrances and validates selected lateral',()=>{
 assert.match(backend,/m\.type==='entrada'&&!m\.anchor/);
 assert.match(backend,/\['top','right','bottom','left'\]/);
 assert.match(backend,/Ponto ancorado fora da borda selecionada/);
});
