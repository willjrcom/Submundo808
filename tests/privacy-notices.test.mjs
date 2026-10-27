import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+p,import.meta.url),'utf8');
test('perfil explica que a permissão GPS não equivale a compartilhar e que há prazo',()=>{
 const content=read('account.tsx');
 assert.match(content,/A permissão de localização não ativa o compartilhamento/);
 assert.match(content,/escolher um evento e um prazo/);
 assert.doesNotMatch(content,/Nenhuma localização é coletada/);
});
test('falha em parar compartilhamento não é silenciosa',()=>{
 const map=read('venue-map.tsx');
 assert.match(map,/Não foi possível confirmar a desativação no servidor/);
 assert.match(map,/setFriendError\(error instanceof Error\?error.message/);
});
