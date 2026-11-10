import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch,matchesSearch} from '../server/search-normalize.mjs';
test('case, accents, cedilla and whitespace are equivalent',()=>{
 assert.equal(normalizeSearch('  SÃO   João  '),'sao joao');
 assert.equal(normalizeSearch('Á Ã À Â ä A'),'a a a a a a');
 assert.ok(matchesSearch(['Arena Mané Garrincha'],'arena'));
 assert.ok(matchesSearch(['Arena Mané Garrincha'],'MANE'));
 assert.ok(matchesSearch(['Café de La Musique'],'cafe'));
 assert.ok(matchesSearch(['São Paulo'],'SAO'));
 assert.ok(matchesSearch(['João'],'joao'));
 assert.ok(matchesSearch(['Ação'],'ACAO'));
 assert.ok(matchesSearch(['Rua das Flores','Vila Velha'],'vila velha'));
 assert.ok(!matchesSearch(['Arena Mané Garrincha'],'teatro'));
});
