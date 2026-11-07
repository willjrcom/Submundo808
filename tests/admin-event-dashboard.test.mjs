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
