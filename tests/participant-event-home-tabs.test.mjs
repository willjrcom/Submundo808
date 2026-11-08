import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('artifacts/submundo-808/src/components/public-events.tsx');
const detail=read('artifacts/submundo-808/src/components/public-event-home.tsx');
const app=read('artifacts/submundo-808/src/App.tsx');
const map=read('artifacts/submundo-808/src/components/venue-map.tsx');
const menu=read('artifacts/submundo-808/src/components/event-menu.tsx');

test('event list and selection remain unchanged; only the selected event home is replaced',()=>{
 assert.match(home,/if\(!event\)return/);
 assert.match(home,/onSelectEvent\(id\)/);
 assert.match(home,/eventProgramPath\(id\)/);
 assert.match(home,/<PublicEventHome key=\{event\.id\} event=\{event\} general=\{general\} timeline=\{timeline\} nowMs=\{nowMs\} onBack=\{backToAgenda\}\/>/);
 assert.match(app,/<PublicEvents activeEventId=\{activeEventId\}/);
 assert.match(app,/<VenueMap activeEventId=\{activeEventId\}/);
 assert.match(app,/<EventMenu activeEventId=\{activeEventId\}/);
});

test('start screen has Destaque, Programação and Info, resetting on selected event change',()=>{
 assert.match(detail,/useState<Section>\('destaque'\)/);
 for(const [id,label] of [['destaque','Destaque'],['programacao','Programação'],['info','Info']]){
  assert.ok(detail.includes("['"+id+"','"+label+"'"),id);
  assert.ok(detail.includes("section==='"+id+"'"),id);
  assert.ok(detail.includes('home-panel-'+id),id);
 }
 assert.match(detail,/role="tablist" aria-label="Seções do evento"/);
 assert.match(detail,/aria-selected=\{section===id\}/);
 assert.match(detail,/onClick=\{onBack\}/);
 assert.match(detail,/Trocar evento/);
});

test('Destaque presents scheduled DJ and next DJ without claiming true live verification',()=>{
 assert.match(detail,/const current=timeline\.find\(slot=>slot\.status==='live'\)/);
 assert.match(detail,/const next=timeline\.find\(slot=>slot\.status==='next'\)/);
 assert.match(detail,/current\?'Tocando agora':'Próxima apresentação'/);
 assert.match(detail,/current\.progress/);
 assert.match(detail,/current\.endMs-nowMs/);
 assert.match(detail,/current&&next&&<article/);
 assert.match(detail,/Line-up em breve/);
 assert.match(detail,/Horários a confirmar/);
 assert.match(detail,/Programação encerrada/);
 assert.match(detail,/Não confirma o início real da apresentação/);
 assert.match(home,/window\.setInterval\(refresh,15000\)/);
 assert.match(home,/getDJTimeline\(event\.lineup,event\.starts_at,nowMs\)/);
});

test('Programação lists saved DJs, real schedule times and optional external music links',()=>{
 assert.match(detail,/timeline\.length\?<div/);
 assert.match(detail,/timeline\.map\(slot=>/);
 assert.match(detail,/slot\.timeLabel/);
 assert.match(detail,/slot\.startMs===null\?'Horário a definir'/);
 assert.match(detail,/dj\.instagram&&<a/);
 assert.match(detail,/dj\.spotify\?\.startsWith\('https:\/\/open\.spotify\.com\/'\)/);
 assert.match(detail,/role="progressbar"/);
 assert.doesNotMatch(detail,/DJ KAU[EÉ]ZIN|DJ VICTOR K|DJ MIR[AÁ]/);
});

test('Info retains real event address, ticket links, contact and general rules',()=>{
 for(const text of ['Abertura dos portões','Período do evento','Sobre o evento','Ver no Maps','Ingressos','Site oficial','Contato oficial','Política de cancelamento','Documentos aceitos']){
  assert.ok(detail.includes(text),text);
 }
 assert.match(detail,/navigator\.clipboard\.writeText\(value\)/);
 assert.match(detail,/general\?\.contact_phone/);
 assert.match(detail,/event\.venue\.services/);
 assert.match(detail,/event\.services/);
 assert.match(detail,/timeZone:EVENT_TIME_ZONE/);
});

test('start screen does not duplicate internal Mapa or Cardápio navigation',()=>{
 assert.doesNotMatch(detail,/>Mapa do evento<|>Cardápio<|>Ver cardápio<|>Meus amigos</);
 assert.doesNotMatch(detail,/navigate\('mapa'\)|navigate\('cardapio'\)/);
 assert.match(app,/id: 'mapa'/);
 assert.match(app,/id: 'cardapio'/);
 assert.match(map,/function VenueMap\(/);
 assert.match(menu,/function EventMenu\(/);
});

test('Destaque mantém ingresso sempre acessível quando o evento tem link configurado',()=>{
 assert.match(detail,/section==='destaque'&&<section/);
 assert.match(detail,/event\.tickets_url\?<a href=\{safeLink\(event\.tickets_url\)\}/);
 assert.match(detail,/Ingressos <ExternalLink size=\{13\}\/>/);
 assert.match(detail,/target="_blank" rel="noopener noreferrer"/);
 assert.match(detail,/\{featured\?<article/);
 assert.match(detail,/Programação encerrada/);
});

test('cabeçalho compacto reúne trocar evento, data resumida e endereço clicável no Maps',()=>{
 assert.match(detail,/return <div className="space-y-3">/);
 assert.match(detail,/<header className="relative isolate overflow-hidden rounded-2xl/);
 assert.match(detail,/className="relative space-y-2\.5 px-4 py-4 sm:px-6 sm:py-5"/);
 assert.match(detail,/className="max-w-lg break-words font-display text-2xl/);
 assert.match(detail,/onClick=\{onBack\}/);
 assert.match(detail,/dateShort\(event\.starts_at\)/);
 assert.match(detail,/const mapsUrl=fullAddress\?'https:\/\/www\.google\.com\/maps\/search\/\?api=1&query='\+encodeURIComponent\(fullAddress\)/);
 assert.match(detail,/\{mapsUrl&&<a href=\{mapsUrl\}/);
 assert.match(detail,/Local · Ver no Maps/);
 assert.doesNotMatch(detail,/Copiar endereço|Copiar endereço do evento|setCopiedAddress/);
});

test('abas internas ficam legíveis no celular sem truncar Programação',()=>{
 assert.match(detail,/grid-cols-\[1fr_1\.35fr_\.75fr\]/);
 assert.match(detail,/className="hidden shrink-0 sm:block"/);
 assert.match(detail,/className="whitespace-nowrap"/);
 assert.doesNotMatch(detail,/<span className="truncate">\{label\}<\/span>/);
});
