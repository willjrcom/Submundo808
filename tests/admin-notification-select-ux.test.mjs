import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-engagement.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../artifacts/submundo-808/src/index.css',import.meta.url),'utf8');

test('cada tipo de notificação explica a finalidade da opção selecionada',()=>{
 for(const type of ['promo','info','lineup','survey']){
  assert.match(component,new RegExp('\\b'+type+":'[^']+'"));
 }
 assert.match(component,/notificationTypeDescriptions\[kind\]/);
 assert.match(component,/aria-live="polite"/);
});

test('o evento só aparece para o público conectado ao evento',()=>{
 assert.match(component,/audience==='event'&&<div[^>]*>/);
 assert.match(component,/aria-label="Selecionar evento"/);
 assert.match(component,/if\(next==='all'\)\{setEventId\(''\);setTargetId\(''\);setTargetKind\('event'\);setEventQuery\(''\);setIncludePastEvents\(false\);\}/);
 assert.match(component,/eventId:kind==='survey'\|\|audience==='event'\?eventId:''/);
 assert.match(component,/setEventId\(n\.kind==='survey'\|\|n\.audience==='event'\?/);
});

test('notificações gerais abrem a página inicial e não um evento inexistente',()=>{
 assert.match(component,/audience==='all'\?<span[^>]*>Início do aplicativo<\/span>/);
 assert.match(component,/setTargetKind\(n\.audience==='all'\?'event'/);
});

test('selects reservam espaço e exibem uma seta recuada nas duas telas',()=>{
 assert.match(styles,/select:not\(\[multiple\]\)\s*\{/);
 assert.match(styles,/appearance:\s*none;/);
 assert.match(styles,/padding-right:\s*2\.75rem;/);
 assert.match(styles,/background-position:\s*right 1rem center;/);
 assert.match(styles,/background-size:\s*1rem 1rem;/);
});

test('uma notificação nova usa todos os usuários por padrão e edição preserva o público salvo',()=>{
 assert.match(component,/\[audience,setAudience\]=useState\('all'\)/);
 assert.match(component,/function reset\(\)\{[^\n]*setAudience\('all'\)/);
 assert.match(component,/function begin\(n\?:Notification\)\{reset\(\);if\(n\)\{[^\n]*setAudience\(n\.audience\)/);
});

test('busca por nome e lista prioriza futuros, mas oferece acesso aos eventos encerrados',()=>{
 assert.match(component,/aria-label="Buscar evento por nome"/);
 assert.match(component,/event\.name\.toLocaleLowerCase\('pt-BR'\)\.includes\(term\)/);
 assert.match(component,/notificationEventIsUpcoming\(event,now\)/);
 assert.match(component,/event\.id===selectedId/);
 assert.match(component,/Incluir eventos encerrados/);
 assert.match(component,/\[includePastEvents,setIncludePastEvents\]=useState\(false\)/);
 assert.match(component,/eventOptions\.map\(e=><option/);
 assert.match(component,/notificationEventLabel\(e\)/);
});
