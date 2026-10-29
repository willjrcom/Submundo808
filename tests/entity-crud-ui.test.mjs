import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const mapUI=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-maps.tsx',import.meta.url),'utf8');
const shell=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');

test('plantas podem ser excluídas pela listagem com confirmação explícita',()=>{
 assert.match(mapUI,/onClick=\{\(\)=>onDelete\(map\)\}/);
 assert.match(mapUI,/Excluir planta/);
 assert.match(shell,/onDelete=\{map=>setConfirmDelete\(\{id:map.id,name:map.name,entity:'map'\}\)\}/);
 assert.match(shell,/onClick=\{\(\)=>void removeConfirmed\(\)\}/);
});
test('backend bloqueia a exclusão de planta vinculada a eventos e local com vínculos',()=>{
 assert.match(server,/entity==='map'&&db.prepare\('SELECT 1 FROM event_maps WHERE map_id=\?'/);
 assert.match(server,/entity==='venue'&&\(db.prepare\('SELECT 1 FROM venue_maps WHERE venue_id=\?'/);
});
test('busca de estabelecimentos considera endereço completo legado',()=>{
 assert.match(server,/OR address LIKE \? ESCAPE/);
});
