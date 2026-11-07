import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const shell=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
const compressor=readFileSync(new URL('../artifacts/submundo-808/src/components/compress-venue-image.ts',import.meta.url),'utf8');
test('edit venue and edit event open dedicated modals instead of replacing dashboard',()=>{
 assert.match(shell,/aria-label=\{'Editar estabelecimento '\+modalVenue\.name\}/);
 assert.match(shell,/aria-label=\{'Editar evento '\+modalEvent\.name\}/);
 assert.match(shell,/onEdit=\{\(\)=>setEventModalId\(editing\.id\)\}/);
 assert.match(shell,/onEdit=\{\(\)=>openVenueEdit\(editing\)\}/);
 assert.match(shell,/setVenueModalId\(null\)/);
 assert.match(shell,/setEventModalId\(null\)/);
 assert.doesNotMatch(shell,/role="tablist" aria-label="Seções do estabelecimento"/);
});
test('dashboard pages are rendered for existing events and venues',()=>{
 assert.match(shell,/<AdminVenueDashboard venue=\{editing\}/);
 assert.match(shell,/<AdminEventDashboard event=\{editing\}/);
 assert.match(shell,/onOpen=\{item=>go\(\{section:'Eventos',id:item\.id,creating:false\}\)\}/);
});
test('venue photo and logo flow into the edit form and API payload',()=>{
 assert.match(shell,/cover_image:coverImage,logo_image:logoImage/);
 assert.match(shell,/compressVenueImage\(file,'cover'\)/);
 assert.match(shell,/compressVenueImage\(file,'logo'\)/);
 assert.match(compressor,/kind==='cover'\?95000:45000/);
});
