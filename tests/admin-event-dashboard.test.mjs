import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dashboard=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-event-dashboard.tsx',import.meta.url),'utf8');
const listing=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-event-list.tsx',import.meta.url),'utf8');
test('event has its own dashboard with cover, dates, lineup, linked maps and Edit action',()=>{
 for(const s of ['event.cover_image','event.starts_at','event.ends_at','event.lineup','linkedMaps','onEdit','onOpenMap','onOpenAnalytics'])assert.ok(dashboard.includes(s),s);
 assert.doesNotMatch(dashboard,/Excluir evento|onDelete/);
});
test('entire event card opens dashboard while Edit remains in its dashboard',()=>{
 assert.match(listing,/onOpen:\(event:EventItem\)=>void/);
 assert.match(listing,/button key=\{event\.id\} type="button" aria-label=\{'Visualizar evento '\+event\.name\} onClick=\{\(\)=>onOpen\(event\)\}/);
 assert.doesNotMatch(listing,/onEdit\(event\)|>Ver evento<\/button>/);
 assert.match(dashboard,/onClick=\{onEdit\}/);
});

test('event analytics button uses a clear statistics label',()=>{
 assert.match(dashboard,/>Ver estatísticas do evento<\/button>/);
 assert.doesNotMatch(dashboard,/>Ver inteligência do evento<\/button>/);
});

test('event linked maps have the same real drawing preview as venue maps',()=>{
 const shared=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-thumbnail.tsx',import.meta.url),'utf8');
 const venues=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-maps.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/aria-label="Carrossel de plantas vinculadas ao evento"/);
 assert.match(dashboard,/areas.filter\(area=>area.map_id===map.id\)/);
 assert.match(dashboard,/<AdminMapThumbnail areas=\{rooms\}\/>/);
 assert.match(venues,/<AdminMapThumbnail areas=\{rooms\}\/>/);
 assert.match(shared,/fetch\('\/api\/admin\/areas'/);
 assert.match(shared,/<svg viewBox="0 0 100 100"/);
 assert.match(shared,/visibleAreas\(areas\)\.map\(area=>/);
 assert.match(shared,/d=\{areaPath\(areas,area\.id\)\}/);
 assert.match(dashboard,/onClick=\{\(\)=>venueId&&onOpenMap\(map.id,venueId\)\}/);
 assert.doesNotMatch(dashboard,/<MapIcon size=\{16\} className="text-\[#c4ff40\]"\/>\{displayLabel\(map.name\)\}/);
});

test('dashboard thumbnails render curved and grouped room paths consistently',()=>{
 const shared=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-thumbnail.tsx',import.meta.url),'utf8');
 assert.match(shared,/import \{areaPath,visibleAreas/);
 assert.match(shared,/fillRule="evenodd"/);
 assert.doesNotMatch(shared,/<rect key=\{area.id\}/);
});
