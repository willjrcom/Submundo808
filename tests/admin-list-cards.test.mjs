import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+name,import.meta.url),'utf8');
const shell=source('admin-shell.tsx');
const eventList=source('admin-event-list.tsx');

test('every venue card is one accessible button opening view mode',()=>{
 const start=shell.indexOf('(filteredVenues??venues).map(item=><button');
 const end=shell.indexOf('</button>)}</div>}',start);
 assert.ok(start>=0&&end>start);
 const card=shell.slice(start,end);
 assert.equal((card.match(/<button\b/g)||[]).length,1);
 assert.match(card,/aria-label=\{'Abrir estabelecimento '\+item\.name\}/);
 assert.match(card,/onClick=\{\(\)=>go\(\{section:'Estabelecimentos',id:item\.id,creating:false\}\)\}/);
 assert.doesNotMatch(card,/onClick=\{\(\)=>openVenueEdit\(item\)\}/);
 assert.match(source('admin-venue-dashboard.tsx'),/onClick=\{onEdit\}/);
});

test('every event card is one accessible button opening view mode',()=>{
 const start=eventList.indexOf('return <button key={event.id}');
 const end=eventList.indexOf('</button>;',start);
 assert.ok(start>=0&&end>start);
 const card=eventList.slice(start,end);
 assert.equal((card.match(/<button\b/g)||[]).length,1);
 assert.match(card,/aria-label=\{'Visualizar evento '\+event\.name\}/);
 assert.match(card,/onClick=\{\(\)=>onOpen\(event\)\}/);
 assert.doesNotMatch(card,/onEdit|>Ver evento<\/button>/);
 assert.match(source('admin-event-dashboard.tsx'),/onClick=\{onEdit\}/);
});
