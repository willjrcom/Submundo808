import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+p,import.meta.url),'utf8');
test('perfil explica que a permissão GPS não equivale a compartilhar e que há prazo',()=>{
 const permissions=read('profile-permissions.tsx');
 const map=read('venue-map.tsx');
 assert.match(permissions,/Sua posição só será compartilhada quando você tocar em Ativar GPS e compartilhar no Mapa/);
 assert.match(map,/Compartilhe com amigos e contribua para estatísticas agregadas até o fim da festa/);
 assert.match(permissions,/Encerrar localização e compartilhamento/);
 assert.doesNotMatch(permissions,/Nenhuma localização é coletada/);
});
test('falha em parar compartilhamento não é silenciosa',()=>{
 const map=read('venue-map.tsx');
 assert.match(map,/Não foi possível confirmar a desativação no servidor/);
 assert.match(map,/setFriendError\(error instanceof Error\?error.message/);
});
