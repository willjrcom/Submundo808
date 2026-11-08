import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupPublicEvents} from '../artifacts/submundo-808/src/components/public-event-agenda.mjs';

const event=(id,start,end)=>({id,name:'Festa '+id,starts_at:start,ends_at:end,venue:{name:'Local',city:'Sorocaba'},lineup:[],map_ids:[]});
const date=value=>{
 if(!value)return null;
 const n=Date.parse(value);
 return Number.isFinite(n)?n:null;
};

test('festa atravessando a madrugada continua em andamento até seu encerramento',()=>{
 const midnight=event('noite','2026-11-07T20:00:00-03:00','2026-11-08T06:00:00-03:00');
 const now=Date.parse('2026-11-08T03:00:00-03:00');
 const groups=groupPublicEvents([midnight],now,date);
 assert.deepEqual(groups.live.map(e=>e.id),['noite']);
 assert.equal(groups.past.length,0);
 assert.equal(groups.upcoming.length,0);
 const atClosing=groupPublicEvents([midnight],date(midnight.ends_at),date);
 assert.deepEqual(atClosing.past.map(e=>e.id),['noite']);
 assert.equal(atClosing.live.length,0);
});

test('próximas festas são ordenadas pelas mais próximas e anteriores pelas mais recentes',()=>{
 const now=Date.parse('2026-11-08T18:00:00-03:00');
 const events=[
  event('brasilia','2026-10-31T20:00:00-03:00','2026-11-01T06:00:00-03:00'),
  event('futura2','2026-12-07T20:00:00-03:00','2026-12-08T06:00:00-03:00'),
  event('sorocaba','2026-11-07T20:00:00-03:00','2026-11-08T06:00:00-03:00'),
  event('futura1','2026-11-15T20:00:00-03:00','2026-11-16T06:00:00-03:00'),
  event('bauru','2026-11-06T20:00:00-03:00','2026-11-07T06:00:00-03:00')
 ];
 const before=events.map(e=>e.id);
 const groups=groupPublicEvents(events,now,date);
 assert.deepEqual(groups.upcoming.map(e=>e.id),['futura1','futura2']);
 assert.deepEqual(groups.past.map(e=>e.id),['sorocaba','bauru','brasilia']);
 assert.deepEqual(groups.live,[]);
 assert.deepEqual(events.map(e=>e.id),before,'a agenda não altera a resposta da API');
});

test('não classifica datas inválidas ou sem encerramento como festa anterior',()=>{
 const now=Date.parse('2026-11-08T18:00:00-03:00');
 const groups=groupPublicEvents([
  event('sem-fim','2026-11-01T20:00:00-03:00',''),
  event('invalido','data inválida','data inválida'),
  event('sem-data','',''),
  event('ainda-vai','2026-11-10T20:00:00-03:00',''),
  event('fim-anterior-ao-inicio','2026-11-10T20:00:00-03:00','2026-11-08T04:00:00-03:00')
 ],now,date);
 assert.deepEqual(groups.past,[]);
 assert.deepEqual(groups.upcoming.map(e=>e.id),['ainda-vai','fim-anterior-ao-inicio']);
 assert.deepEqual(groups.undated.map(e=>e.id),['sem-fim','invalido','sem-data']);
});

test('usa parser fornecido para interpretar o horário local da festa, não o fuso do dispositivo',()=>{
 const local=timestamp=>date(timestamp?.endsWith('Z')?timestamp:timestamp?.length===16?timestamp+':00-03:00':timestamp);
 const overnight=event('local','2026-11-07T20:00','2026-11-08T06:00');
 const before=Date.parse('2026-11-08T05:59:59-03:00');
 assert.equal(groupPublicEvents([overnight],before,local).live.length,1);
 const after=Date.parse('2026-11-08T06:00:00-03:00');
 assert.equal(groupPublicEvents([overnight],after,local).past.length,1);
});

test('os eventos anteriores ficam recolhidos por padrão, sem perder acesso à programação',()=>{
 const src=readFileSync(new URL('../artifacts/submundo-808/src/components/public-events.tsx',import.meta.url),'utf8');
 assert.match(src,/groupPublicEvents\(events,nowMs,parseEventTimestamp\)/);
 assert.match(src,/const \[pastExpanded,setPastExpanded\]=useState\(false\)/);
 assert.match(src,/aria-label="Acontecendo agora"/);
 assert.match(src,/aria-label="Próximas festas"/);
 assert.match(src,/aria-label="Festas anteriores"/);
 assert.match(src,/aria-expanded=\{pastExpanded\}/);
 assert.match(src,/onClick=\{\(\)=>setPastExpanded\(open=>!open\)\}/);
 assert.match(src,/pastExpanded&&<div id="previous-events-list"/);
 assert.match(src,/agenda\.past\.map\(e=>eventCard\(e,true\)\)/);
 assert.match(src,/Rever programação/);
 assert.match(src,/onClick=\{\(\)=>openEvent\(e\.id\)\}/);
 assert.match(src,/changeUrl\(eventProgramPath\(id\)\)/);
 assert.match(src,/Nenhuma próxima festa anunciada/);
 assert.doesNotMatch(src,/\{events\.map\(e=>/);
});
