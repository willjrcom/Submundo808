import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDjLinks,validateEventFields} from '../artifacts/submundo-808/src/components/event-save-validation.ts';
import {readFileSync} from 'node:fs';

test('legacy DJs without social properties no longer crash the Save button',()=>{
 assert.equal(validateDjLinks([{nome:'DJ 01'},{nome:'DJ 02',instagram:undefined,spotify:undefined}]),null);
 assert.equal(validateDjLinks([{nome:'DJ 03',instagram:'https://www.instagram.com/artist/'}]),null);
 assert.equal(validateDjLinks([{nome:'DJ 04',spotify:'https://open.spotify.com/artist/abc'}]),null);
 assert.match(validateDjLinks([{nome:'DJ 05',instagram:'@artist'}]),/link completo HTTPS/);
});
test('required event data and date range validated regardless of active tab',()=>{
 assert.equal(validateEventFields('','venue','','',[]),'Informe o nome do evento.');
 assert.equal(validateEventFields('Nome','','','',[]),'Selecione o estabelecimento.');
 assert.match(validateEventFields('Nome','venue','2026-11-08T21:00','2026-11-08T20:00',[]),/posterior/);
 assert.equal(validateEventFields('Nome','venue','2026-11-08T20:00','2026-11-09T06:00',['https://meaple.com.br/808']),null);
 assert.match(validateEventFields('Nome','venue','','',['not a url']),/URLs válidas/);
});
test('event form validates JavaScript-side and preserves API error feedback',()=>{
 const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-editors.tsx',import.meta.url),'utf8');
 assert.match(editor,/<form noValidate onSubmit=\{save\}/);
 assert.match(editor,/validateEventFields\(name,venue,starts,ends/);
 assert.match(editor,/validateDjLinks\(djs\)/);
 assert.match(editor,/setSaving\(true\)/);
 assert.match(editor,/finally\{setSaving\(false\);\}/);
});
