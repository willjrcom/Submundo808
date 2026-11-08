import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';

test('old and new map URLs parse, and links use canonical English paths',()=>{
 const id='367c512d-e97c-4ea8-983f-64fd6621775a';
 for(const path of ['/mapas/'+id,'/maps/'+id]){
  const route=parseAdminRoute(path);
  assert.deepEqual(route,{section:'Mapas e ambientes',id,creating:false});
  assert.equal(adminRoutePath(route),'/maps/'+id);
 }
});

test('section aliases restore canonical admin route after refreshing',()=>{
 for(const [url,section,canonical] of [
  ['/','Visão geral','/'],
  ['/estabelecimentos','Estabelecimentos','/venues'],
  ['/mapas','Mapas e ambientes','/maps'],
  ['/eventos','Eventos','/events'],
  ['/produtos','Produtos','/products']
 ]){
  const route=parseAdminRoute(url);
  assert.equal(route.section,section);
  assert.equal(route.id,null);
  assert.equal(adminRoutePath(route),canonical);
 }
});

test('creation pages restore and keep their canonical URL',()=>{
 for(const [path,canonical] of [
  ['/estabelecimentos/novo','/venues/new'],
  ['/mapas/novo','/maps/new'],
  ['/eventos/novo','/events/new']
 ]){
  const route=parseAdminRoute(path);
  assert.equal(route.creating,true);
  assert.equal(route.id,null);
  assert.equal(adminRoutePath(route),canonical);
 }
});

test('edit pages use matching section and entity id',()=>{
 for(const [path,section,canonical] of [
  ['/estabelecimentos/abc-123','Estabelecimentos','/venues/abc-123'],
  ['/eventos/abc-123','Eventos','/events/abc-123']
 ]){
  const route=parseAdminRoute(path);
  assert.equal(route.section,section);
  assert.equal(route.id,'abc-123');
  assert.equal(adminRoutePath(route),canonical);
 }
});

test('unknown paths and trailing slash do not create invalid editors',()=>{
 assert.equal(parseAdminRoute('/mapas/').section,'Mapas e ambientes');
 assert.deepEqual(parseAdminRoute('/nao-existe'),{section:'Visão geral',id:null,creating:false});
});

test('venue floor plan deep link preserves both ids',()=>{
 const route=parseAdminRoute('/estabelecimentos/venue-42/mapas/map-17');
 assert.deepEqual(route,{section:'Estabelecimentos',id:'venue-42',creating:false,mapId:'map-17'});
 assert.equal(adminRoutePath(route),'/venues/venue-42/maps/map-17');
});

test('standalone event menu deep link preserves event id',()=>{
 assert.deepEqual(parseAdminRoute('/events/event-42/menu'),{section:'Eventos',id:'event-42',creating:false,menu:true});
 assert.equal(adminRoutePath(parseAdminRoute('/eventos/event-42/cardapio')),'/events/event-42/menu');
});
