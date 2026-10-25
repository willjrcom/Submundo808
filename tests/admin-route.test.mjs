import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';

test('recarregar na edição do mapa mantém a seção e o mesmo mapa',()=>{
 const id='367c512d-e97c-4ea8-983f-64fd6621775a';
 const url='/mapas/'+id;
 assert.deepEqual(parseAdminRoute(url),{section:'Mapas e ambientes',id,creating:false});
 assert.equal(adminRoutePath(parseAdminRoute(url)),url);
});
test('restaura cada aba do admin pela URL',()=>{
 for(const [path,section] of [
  ['/','Visão geral'],
  ['/estabelecimentos','Estabelecimentos'],
  ['/mapas','Mapas e ambientes'],
  ['/eventos','Eventos'],
  ['/produtos','Produtos e cardápios']
 ]){
  const route=parseAdminRoute(path);
  assert.equal(route.section,section);
  assert.equal(route.id,null);
  assert.equal(adminRoutePath(route),path);
 }
});
test('restaura formulários de criação, inclusive após atualizar',()=>{
 for(const path of ['/estabelecimentos/novo','/mapas/novo','/eventos/novo']){
  const route=parseAdminRoute(path);
  assert.equal(route.creating,true);
  assert.equal(route.id,null);
  assert.equal(adminRoutePath(route),path);
 }
});
test('edição de estabelecimentos e eventos usa URL da seção correta',()=>{
 for(const path of ['/estabelecimentos/abc-123','/eventos/abc-123']){
  const route=parseAdminRoute(path);
  assert.equal(route.id,'abc-123');
  assert.equal(adminRoutePath(route),path);
 }
});
test('barra final e rota desconhecida não redirecionam para um editor inválido',()=>{
 assert.equal(parseAdminRoute('/mapas/').section,'Mapas e ambientes');
 assert.deepEqual(parseAdminRoute('/nao-existe'),{section:'Visão geral',id:null,creating:false});
});
