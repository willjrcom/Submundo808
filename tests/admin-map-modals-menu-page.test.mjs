import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAdminRoute,adminRoutePath} from '../artifacts/submundo-808/src/components/admin-route.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const maps=read('artifacts/submundo-808/src/components/admin-venue-maps.tsx');
const workspace=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const menu=read('artifacts/submundo-808/src/components/admin-products.tsx');
const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
const editor=read('artifacts/submundo-808/src/components/admin-editors.tsx');
const dashboard=read('artifacts/submundo-808/src/components/admin-event-dashboard.tsx');

test('new map uses accessible modal with confirmation for unsaved drafts',()=>{
 assert.match(maps,/aria-haspopup="dialog" aria-expanded=\{creating\}/);
 assert.match(maps,/role="dialog" aria-modal="true" aria-labelledby="create-map-title"/);
 assert.match(maps,/autoFocus required maxLength=\{100\}/);
 assert.match(maps,/onSubmit=\{event=>void create\(event\)\}/);
 assert.match(maps,/adminRequest\('maps',\{name,venue_id:venue.id\}\)/);
 assert.match(maps,/const \[creating,setCreating\]=useState\(false\),\[newName,setNewName\]=useState\(''\),\[confirmDiscard,setConfirmDiscard\]=useState\(false\)/);
 assert.match(maps,/role="alertdialog" aria-modal="true" aria-label="Descartar novo mapa\?"/);
 assert.match(maps,/function requestClose\(\)/);
 assert.doesNotMatch(maps,/creating&&<form onSubmit=/);
});
test('rename floor plan keeps the existing name until successful modal save',()=>{
 assert.match(workspace,/aria-haspopup="dialog" aria-expanded=\{renameOpen\}/);
 assert.match(workspace,/role="dialog" aria-modal="true" aria-labelledby="rename-map-title"/);
 assert.match(workspace,/const \[mapName,setMapName\]=useState\(map.name\),\[renameDraft,setRenameDraft\]/);
 assert.match(workspace,/onClick=\{\(\)=>\{setRenameDraft\(mapName\);setRenameError\(''\);setRenameOpen\(true\);\}\}/);
 assert.match(workspace,/api\('edit-map',\{id:map.id,venue_id:map.venue_id,name\}\);setMapName\(name\)/);
 assert.match(workspace,/setRenameError\(e instanceof Error/);
 assert.match(workspace,/disabled=\{nameSaving\|\|!renameDraft.trim\(\)\|\|renameDraft.trim\(\)===mapName\}/);
 assert.doesNotMatch(workspace,/renameOpen&&  <form/);
});
test('cardápio deep link stays in the current event after refresh',()=>{
 for(const url of ['/events/event-123/menu','/eventos/event-123/cardapio']){
  const route=parseAdminRoute(url);
  assert.deepEqual(route,{section:'Eventos',id:'event-123',creating:false,menu:true});
  assert.equal(adminRoutePath(route),'/events/event-123/menu');
 }
 assert.deepEqual(parseAdminRoute('/events/new/menu'),{section:'Eventos',id:null,creating:false});
});
test('event dashboard and edit dialog navigate to standalone menu page',()=>{
 assert.match(dashboard,/onOpenMenu:\(\)=>void/);
 assert.match(dashboard,/> Gerenciar cardápio<\/button>/);
 assert.match(shell,/:editing&&route.menu\?<section/);
 assert.match(shell,/<EventMenuEditor key=\{editing.id\} eventId=\{editing.id\} onBack=/);
 assert.match(shell,/onOpenMenu=\{\(\)=>go\(\{section:'Eventos',id:editing.id,creating:false,menu:true\}\)\}/);
 assert.match(shell,/onOpenMenu=\{\(\)=>go\(\{section:'Eventos',id:modalEvent.id,creating:false,menu:true\}\)\}/);
 assert.match(editor,/>Abrir editor de cardápio<\/button>/);
 assert.match(editor,/onClick=\{requestMenu\}/);
 assert.match(editor,/Alterações do evento não salvas/);
 assert.doesNotMatch(editor,/<EventMenuEditor key=/);
});
test('dedicated menu persists through the same endpoint, and warns before discarding',()=>{
 assert.match(menu,/export function EventMenuEditor\(\{eventId,onBack\}/);
 assert.match(menu,/api\('event-products\?event_id='\+encodeURIComponent\(eventId\)\)/);
 assert.match(menu,/api\('save-event-products',\{event_id:eventId,items\}\)/);
 assert.match(menu,/setSelected\(next\);setSavedSelection\(next\)/);
 assert.match(menu,/setSavedSelection\(submitted\)/);
 assert.match(menu,/const dirty=!loading&&JSON.stringify\(selected\)!==JSON.stringify\(savedSelection\)/);
 assert.match(menu,/role="alertdialog" aria-modal="true" aria-labelledby="discard-menu-title"/);
 assert.match(menu,/>Descartar e voltar<\/button>/);
 assert.match(menu,/beforeunload/);
});
