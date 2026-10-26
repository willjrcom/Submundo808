import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const component=(name)=>readFileSync(
 new URL('../artifacts/submundo-808/src/components/'+name+'.tsx',import.meta.url),'utf8'
);
const app=readFileSync(new URL('../artifacts/submundo-808/src/App.tsx',import.meta.url),'utf8');

test('amigos não mostra formulário de adicionar antes de validar a autenticação',()=>{
 const source=component('friends');
 assert.match(source,/useState<'loading'\|'guest'\|'authenticated'\|'error'>\('loading'\)/);
 assert.match(source,/if\(showLoading\)return <PageLoading/);
 assert.match(source,/access==='guest'/);
 assert.match(source,/setAccess\('authenticated'\)/);
});
test('página de perfil só aparece depois da resposta de /auth/me',()=>{
 const source=component('account');
 assert.match(source,/\[loading,setLoading\]=useState\(true\)/);
 assert.match(source,/request\('me'\)/);
 assert.match(source,/if\(showLoading\)return <PageLoading/);
 assert.match(source,/if\(initialError\)return <div role="alert"/);
});
test('eventos e cardápio renderizam loading antes do conteúdo definitivo',()=>{
 assert.match(component('public-events'),/if\(showLoading\)return <PageLoading/);
 assert.match(component('event-menu'),/showLoading\?<PageLoading compact/);
});
test('mapa aguarda primeira carga de mapas, preferências e amigos',()=>{
 const source=component('venue-map');
 assert.match(source,/\[mapsReady,setMapsReady\]=useState\(false\)/);
 assert.match(source,/\[friendsReady,setFriendsReady\]=useState\(false\)/);
 assert.match(source,/finally\{if\(alive\)setFriendsReady\(true\);\}/);
 assert.match(source,/!mapsReady\|\|loadedForEventId!==activeEventId\|\|!mapResolved\|\|!prefsReady\|\|!friendsReady/);
 assert.match(source,/return <PageLoading label="Carregando mapa"/);
});
test('painel administrativo só mostra dados depois de carregar autenticação e métricas',()=>{
 const source=component('admin-shell');
 assert.match(source,/useMinimumLoading\(user===undefined\|\|\(!!user\?\.isAdmin&&!listsLoaded\)\)/);
 assert.match(source,/return <div className="flex min-h-dvh items-center justify-center bg-\[#0b090f\]/);
 assert.match(source,/if\(user\?\.isAdmin&&loadFailed\)/);
});
test('editor de mapas aguarda ambientes e pontos antes de mostrar o canvas',()=>{
 const source=component('admin-map-workspace');
 assert.match(source,/if\(showLoading\)return <div className="space-y-4"/);
 assert.match(source,/if\(initialLoadError\)return <div role="alert"/);
});
test('catálogo e preços por evento não exibem listas vazias enquanto buscam dados',()=>{
 const source=component('admin-products');
 assert.match(source,/if\(showInitialLoading\)return <PageLoading/);
 assert.match(source,/if\(initialFailed\)return <div role="alert"/);
 assert.match(source,/showAssignmentLoading\?<PageLoading compact/);
});
test('barra de navegação não muda após montar e mapa não fica um frame vazio',()=>{
 assert.match(app,/\{tabs\.map\(\(\{id,title,Icon\}\)/);
 assert.match(app,/if\(next==='mapa'\)setMapMounted\(true\);setTab\(next\)/);
 assert.match(app,/\{mapMounted&&<div hidden=\{tab!=='mapa'\}/);
});
test('QR Code reserva espaço antes de carregar a imagem e não desloca o perfil',()=>{
 const source=component('friend-qr');
 assert.match(source,/h-\[284px\]/);
 assert.match(source,/imageReady/);
 assert.match(source,/onLoad=\{\(\)=>setImageReady\(true\)\}/);
});
test('loading compartilhado sinaliza progresso para tecnologias assistivas',()=>{
 const source=component('page-loading');
 assert.match(source,/role="status"/);
 assert.match(source,/aria-busy="true"/);
 assert.match(source,/motion-safe:animate-spin/);
});


test('carregamento respeita mínimo de 500 ms em todas as telas',()=>{
 const hook=readFileSync(new URL('../artifacts/submundo-808/src/components/use-minimum-loading.ts',import.meta.url),'utf8');
 assert.match(hook,/MINIMUM_LOADING_MS=500/);
 assert.match(hook,/Math\.max\(0,minMs-\(Date\.now\(\)-startedAt\.current\)\)/);
 for(const page of ['friends','account','public-events','event-menu','venue-map','admin-shell','admin-map-workspace','admin-products']){
  assert.match(component(page),/useMinimumLoading\(/);
 }
});
test('mapa mostra ativar localização no começo do conteúdo',()=>{
 const source=component('venue-map');
 const start=source.indexOf('return <section className="space-y-3">');
 const gps=source.indexOf("Ativar localização",start);
 const map=source.indexOf("Mapa do evento",start);
 assert.ok(start>=0&&gps>start&&map>gps);
});
test('botão de convite apresenta adicionar amigo',()=>{
 const source=component('friends');
 assert.match(source,/<ScanLine size=\{19\}\/> Adicionar amigo/);
 assert.doesNotMatch(source,/Abrir câmera<\/button>/);
});
