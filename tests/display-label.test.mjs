import test from 'node:test';
import assert from 'node:assert/strict';
import {displayLabel,displayDescription,displayAddress} from '../artifacts/submundo-808/src/components/display-label.ts';

test('remove sufixos antigos dos nomes já cadastrados sem alterar o original',()=>{
 const raw='Pista principal — DEMO';
 assert.equal(displayLabel(raw),'Pista principal');
 assert.equal(raw,'Pista principal — DEMO');
 assert.equal(displayLabel('SUBMUNDO 808 — Edição Demo'),'SUBMUNDO 808');
 assert.equal(displayLabel('Espaço Submundo — DEMO'),'Espaço Submundo');
});
test('preserva nomes normais, incluindo a palavra dentro de um nome válido',()=>{
 assert.equal(displayLabel('Pista principal'),'Pista principal');
 assert.equal(displayLabel('Teste de som ao vivo'),'Teste de som ao vivo');
 assert.equal(displayLabel('Casa de Shows'),'Casa de Shows');
});
test('oculta apenas descrições e endereços padronizados do gerador antigo',()=>{
 assert.equal(displayDescription('Evento demonstrativo completo para testar a experiência do participante. DJs, local e horários são fictícios.'),'');
 assert.equal(displayAddress('Endereço fictício para testes'),'');
 assert.equal(displayAddress('Rua das Flores, 100'),'Rua das Flores, 100');
 assert.equal(displayDescription('Abertura às 22h'),'Abertura às 22h');
});
