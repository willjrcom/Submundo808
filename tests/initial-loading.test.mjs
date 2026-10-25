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
 assert.match(source,/if\(access==='loading'\)return <PageLoading/);
 assert.match(source,/access==='guest'/);
 assert.match(source,/setAccess\('authenticated'\)/);
});
test('página de perfil só aparece depois da resposta de /auth/me',()=>{
 const source=component('account');
 assert.match(source,/\[loading,setLoading\]=useState\(true\)/);
 assert.match(source,/request\('me'\)/);
 assert.match(source,/if\(loading\)return <PageLoading/);
 assert.match(source,/if\(initialError\)return <div role="alert"/);
});
test('eventos e cardápio renderizam loading antes do conteúdo definitivo',()=>{
 assert.match(component('public-events'),/if\(loading\)return <PageLoading/);
 assert.match(component('event-menu'),/if\(loading\)return <PageLoading/);
});
test('mapa aguarda primeira carga de mapas, preferências e amigos',()=>{
 const source=component('venue-map');
 assert.match(source,/\[mapsReady,setMapsReady\]=useState\(false\)/);
 assert.match(source,/\[friendsReady,setFriendsReady\]=useState\(false\)/);
 assert.match(source,/finally\{if\(alive\)setFriendsReady\(true\);\}/);
 assert.match(source,/!mapsReady\|\|!mapResolved\|\|!prefsReady\|\|!friendsReady/);
 assert.match(source,/return <PageLoading label="Carregando mapa"/);
});
test('painel administrativo só mostra dados depois de carregar autenticação e métricas',()=>{
 const source=component('admin-shell');
 assert.match(source,/user===undefined\|\|\(user\?\.isAdmin&&!listsLoaded\)/);
 assert.match(source,/return <div className="flex min-h-dvh items-center justify-center bg-\[#0b090f\]/);
 assert.match(source,/if\(user\?\.isAdmin&&loadFailed\)/);
});
test('editor de mapas aguarda ambientes e pontos antes de mostrar o canvas',()=>{
 const source=component('admin-map-workspace');
 assert.match(source,/if\(loading\)return <div className="space-y-4"/);
 assert.match(source,/if\(initialLoadError\)return <div role="alert"/);
});
test('catálogo e preços por evento não exibem listas vazias enquanto buscam dados',()=>{
 const source=component('admin-products');
 assert.match(source,/if\(!initialReady\)return <PageLoading/);
 assert.match(source,/if\(initialFailed\)return <div role="alert"/);
 assert.match(source,/loadedAssignmentsFor!==eventId\?<PageLoading compact/);
});
test('barra de navegação não muda após montar e mapa não fica um frame vazio',()=>{
 assert.match(app,/useState\(\(\)=>!!localStorage\.getItem\('submundo-event-id'\)\)/);
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
