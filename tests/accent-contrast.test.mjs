import test from 'node:test';
import assert from 'node:assert/strict';
import {accentTextColor,contrastRatio,readableAccentOnDark} from '../artifacts/submundo-808/src/accent-contrast.ts';

test('todo tom de cor permite texto legível em botões',()=>{
 for(const color of ['#c4ff40','#3b82f6','#a855f7','#101010','#ffffff','#000000','#ff0000']){
  const foreground=accentTextColor(color);
  assert.ok(contrastRatio(color,foreground)>=4.5, color+' '+foreground);
 }
});
test('destaques preservam a cor ou elevam contraste sobre o fundo escuro',()=>{
 for(const color of ['#101010','#2a1139','#a855f7','#c4ff40','#000000']){
  const readable=readableAccentOnDark(color);
  assert.ok(contrastRatio(readable,'#0b090f')>=4.5, color+' -> '+readable);
 }
 assert.equal(readableAccentOnDark('#c4ff40'),'#c4ff40');
});
test('cores inválidas são rejeitadas',()=>assert.throws(()=>contrastRatio('yellow','#000000')));
