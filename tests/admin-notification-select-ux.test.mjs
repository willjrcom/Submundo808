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
 assert.match(component,/audience==='event'&&<label[^>]*>Evento<select/);
 assert.match(component,/if\(next==='all'\)\{setEventId\(''\);setTargetId\(''\);setTargetKind\('event'\);\}/);
 assert.match(component,/eventId:audience==='event'\?eventId:''/);
 assert.match(component,/setEventId\(n\.audience==='event'\?/);
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
