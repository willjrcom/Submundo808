import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const mapUI=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-maps.tsx',import.meta.url),'utf8');
const eventUI=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-event-list.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('listing venues, events and maps does not show delete actions',()=>{
 for(const source of [mapUI,eventUI,shell])assert.doesNotMatch(source,/onDelete=|onDelete\(|Excluir planta|Excluir estabelecimento|setConfirmDelete/);
 assert.match(mapUI,/aria-label=\{'Editar planta '\+map\.name\}/);
 assert.match(eventUI,/onClick=\{\(\)=>onEdit\(event\)\}/);
 assert.match(shell,/Abrir estabelecimento/);
});
test('backend still protects related venues and maps against direct delete requests',()=>{
 assert.match(server,/entity==='map'&&db.prepare\('SELECT 1 FROM event_maps WHERE map_id=\?'/);
 assert.match(server,/entity==='venue'&&\(db.prepare\('SELECT 1 FROM venue_maps WHERE venue_id=\?'/);
});
test('venue search still checks the legacy full address',()=>{
 assert.match(server,/OR address LIKE \? ESCAPE/);
});
