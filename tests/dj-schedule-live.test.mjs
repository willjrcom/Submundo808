import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 EVENT_TIME_ZONE,parseEventTimestamp,getDJTimeline,formatDJTimeRange
} from '../artifacts/submundo-808/src/components/dj-schedule.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const eventStart='2026-11-08T21:00';
const at=value=>{
 const result=parseEventTimestamp(value);
 assert.notEqual(result,null,'expected valid time '+value);
 return result;
};
const djs=[
 {nome:'DJ 01',inicio:'2026-11-08T22:00',fim:'2026-11-08T23:40'},
 {nome:'DJ 02',inicio:'2026-11-08T23:40',fim:'2026-11-09T01:00'},
 {nome:'DJ 03',inicio:'2026-11-09T01:00',fim:'2026-11-09T03:00'}
];

test('horários datetime-local são interpretados no fuso do evento, não no computador do participante',()=>{
 assert.equal(EVENT_TIME_ZONE,'America/Sao_Paulo');
 assert.equal(new Date(at('2026-11-08T22:00')).toISOString(),'2026-11-09T01:00:00.000Z');
 assert.equal(new Date(at('2026-11-09T01:00')).toISOString(),'2026-11-09T04:00:00.000Z');
 assert.equal(at('2026-11-08T22:00'),at('2026-11-09T01:00:00Z'));
 assert.equal(at('2026-11-08T22:00'),at('2026-11-08T22:00:00-03:00'));
 assert.equal(at('2026-11-08 22:00'),at('2026-11-08T22:00'));
 assert.equal(parseEventTimestamp('2026-11-08T25:00'),null);
 assert.equal(parseEventTimestamp('2026-02-30T19:00'),null);
 assert.equal(parseEventTimestamp(''),null);
});

test('início incluso, fim exclusivo: troca de DJ exata à meia-noite sem duplicar ao vivo',()=>{
 const before=getDJTimeline(djs,eventStart,at('2026-11-08T23:39'));
 assert.equal(before.find(x=>x.status==='live')?.dj.nome,'DJ 01');
 assert.equal(before.find(x=>x.status==='next')?.dj.nome,'DJ 02');
 const changed=getDJTimeline(djs,eventStart,at('2026-11-08T23:40'));
 assert.equal(changed.filter(x=>x.status==='live').length,1);
 assert.equal(changed.find(x=>x.status==='live')?.dj.nome,'DJ 02');
 assert.equal(changed.find(x=>x.status==='finished')?.dj.nome,'DJ 01');
 assert.equal(changed.find(x=>x.status==='next')?.dj.nome,'DJ 03');
 const midnight=getDJTimeline(djs,eventStart,at('2026-11-09T00:30'));
 assert.equal(midnight.find(x=>x.status==='live')?.dj.nome,'DJ 02');
 assert.equal(midnight.find(x=>x.status==='live')?.timeLabel,'23:40 — 01:00 (+1 dia)');
 const final=getDJTimeline(djs,eventStart,at('2026-11-09T03:00'));
 assert.equal(final.filter(x=>x.status==='live').length,0);
 assert.equal(final.filter(x=>x.status==='finished').length,3);
});

test('o foco e o progresso mudam com o relógio sem depender de fetch',()=>{
 const start=at('2026-11-08T23:40');
 const mid=at('2026-11-09T00:20');
 const now=getDJTimeline(djs,eventStart,mid);
 const current=now.find(x=>x.status==='live');
 assert.ok(current);
 assert.equal(current.dj.nome,'DJ 02');
 assert.equal(current.progress,50);
 const next=getDJTimeline(djs,eventStart,at('2026-11-09T01:00'));
 assert.equal(next.find(x=>x.status==='live')?.dj.nome,'DJ 03');
 assert.ok(start<mid);
});

test('line-up legado HH:mm é interpretado relativo à data da festa, incluindo madrugada',()=>{
 const legacy=[
  {nome:'Começo',inicio:'22:00',fim:'23:30'},
  {nome:'Meia-noite',inicio:'23:30',fim:'00:30'},
  {nome:'Madrugada',inicio:'00:30',fim:'02:00'}
 ];
 const slots=getDJTimeline(legacy,eventStart,at('2026-11-09T00:45'));
 assert.equal(slots.find(x=>x.status==='live')?.dj.nome,'Madrugada');
 assert.equal(slots.find(x=>x.status==='finished'&&x.dj.nome==='Meia-noite')?.timeLabel,'23:30 — 00:30 (+1 dia)');
 assert.equal(slots.find(x=>x.dj.nome==='Madrugada')?.timeLabel,'00:30 — 02:00');
});

test('não inventa DJ tocando quando faltam horários ou os intervalos são inválidos',()=>{
 const input=[
  {nome:'Sem horário'}, {nome:'Só começo',inicio:'2026-11-08T22:00'},
  {nome:'Incorreto',inicio:'2026-11-08T23:00',fim:'2026-11-08T22:00'},
  {nome:'Primeiro',inicio:'2026-11-09T01:00',fim:'2026-11-09T02:00'}
 ];
 const before=getDJTimeline(input,eventStart,at('2026-11-08T22:50'));
 assert.equal(before.find(x=>x.status==='live'),undefined);
 assert.equal(before.find(x=>x.status==='next')?.dj.nome,'Primeiro');
 assert.equal(before.filter(x=>x.status==='unscheduled').length,3);
 assert.equal(formatDJTimeRange({nome:'DJ',inicio:'2026-11-08T22:00',fim:'2026-11-09T01:00'},eventStart),'22:00 — 01:00 (+1 dia)');
});

test('o line-up é apresentado em ordem cronológica, sem perder os vínculos sociais',()=>{
 const reversed=[djs[2],djs[0],djs[1]].map(x=>({...x,instagram:'https://www.instagram.com/example/',spotify:'https://open.spotify.com/artist/123'}));
 const sorted=getDJTimeline(reversed,eventStart,at('2026-11-08T21:00'));
 assert.deepEqual(sorted.map(x=>x.dj.nome),['DJ 01','DJ 02','DJ 03']);
 assert.equal(sorted[0].dj.instagram,reversed[1].instagram);
 assert.equal(sorted[0].dj.spotify,reversed[1].spotify);
});

test('aba Início usa data e hora, se atualiza automaticamente e destaca o DJ sem rede',()=>{
 const app=read('artifacts/submundo-808/src/components/public-events.tsx');
 const admin=read('artifacts/submundo-808/src/components/admin-editors.tsx');
 const server=read('server/index.mjs');
 assert.match(app,/getDJTimeline\(event\.lineup,event\.starts_at,nowMs\)/);
 assert.match(app,/window\.setInterval\(refresh,15000\)/);
 assert.match(app,/document\.addEventListener\('visibilitychange',refresh\)/);
 assert.match(app,/currentlyPlaying=timeline\.find\(slot=>slot\.status==='live'\)/);
 assert.match(app,/nextDJ=timeline\.find\(slot=>slot\.status==='next'\)/);
 assert.match(app,/aria-label="DJ tocando agora"/);
 assert.match(app,/Tocando agora/);
 assert.match(app,/Em seguida/);
 assert.match(app,/slot\.timeLabel/);
 assert.match(app,/aria-valuenow=\{currentlyPlaying\.progress\}/);
 assert.match(app,/Conforme horário programado/);
 assert.match(app,/inclusive offline/);
 assert.match(admin,/type="datetime-local" className=\{input\+' \[color-scheme:dark\]'\} value=\{dj\[k\]\}/);
 assert.match(server,/lineup:JSON\.parse\(e\.lineup_json\|\|'\\[\\]'\)/);
});
