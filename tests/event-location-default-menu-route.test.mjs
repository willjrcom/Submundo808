import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {applyEventLocationSharing} from '../server/event-location-sharing.mjs';
import {parseAdminRoute,adminRoutePath,isKnownAdminPath} from '../artifacts/submundo-808/src/components/admin-route.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE events(id TEXT PRIMARY KEY,location_sharing_enabled INTEGER NOT NULL DEFAULT 0); CREATE TABLE location_preferences(user_id TEXT PRIMARY KEY,gps_enabled INTEGER NOT NULL DEFAULT 0,share_enabled INTEGER NOT NULL DEFAULT 0,share_with_groups INTEGER NOT NULL DEFAULT 0,share_expires_at INTEGER,share_event_id TEXT,analytics_enabled INTEGER NOT NULL DEFAULT 0,analytics_event_id TEXT,updated_at INTEGER NOT NULL DEFAULT 0); CREATE TABLE live_locations(user_id TEXT PRIMARY KEY,lat REAL,lng REAL,updated_at INTEGER NOT NULL DEFAULT 0);');
 db.prepare('INSERT INTO events VALUES(?,?)').run('festival',1);
 db.prepare('INSERT INTO events VALUES(?,?)').run('other',1);
 db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?,?,?)').run('orphan',0,0,0,null,null,1,'festival',50);
 for(const [user,event] of [['friend','festival'],['other-user','other']]){
  db.prepare('INSERT INTO location_preferences VALUES(?,?,?,?,?,?,?,?,?)').run(user,1,1,0,10000,event,1,event,50);
  db.prepare('INSERT INTO live_locations VALUES(?,?,?,?)').run(user,-23,-47,50);
 }
 return db;
}

test('desabilitar evento remove posições e estatísticas somente de sua festa',()=>{
 const db=fixture();
 try{
  applyEventLocationSharing(db,'festival',false,123456);
  assert.equal(db.prepare("SELECT location_sharing_enabled FROM events WHERE id='festival'").get().location_sharing_enabled,0);
  assert.equal(db.prepare("SELECT 1 FROM live_locations WHERE user_id='friend'").get(),undefined);
  assert.equal(db.prepare("SELECT 1 FROM live_locations WHERE user_id='other-user'").get()!==undefined,true);
  const pref=db.prepare("SELECT * FROM location_preferences WHERE user_id='friend'").get();
  assert.equal(pref.share_enabled,0);
  assert.equal(pref.gps_enabled,0);
  assert.equal(pref.analytics_enabled,0);
  assert.equal(pref.share_event_id,null);
  assert.equal(pref.analytics_event_id,null);
  assert.equal(pref.updated_at,123456);
  assert.equal(db.prepare("SELECT share_enabled FROM location_preferences WHERE user_id='other-user'").get().share_enabled,1);
  assert.equal(db.prepare("SELECT analytics_enabled FROM location_preferences WHERE user_id='orphan'").get().analytics_enabled,0);
  assert.equal(db.prepare("SELECT location_sharing_enabled FROM events WHERE id='other'").get().location_sharing_enabled,1);
 }finally{db.close();}
});

test('reativar evento não liga o GPS nem o compartilhamento dos participantes',()=>{
 const db=fixture();
 try{
  applyEventLocationSharing(db,'festival',false);
  applyEventLocationSharing(db,'festival',true);
  assert.equal(db.prepare("SELECT location_sharing_enabled FROM events WHERE id='festival'").get().location_sharing_enabled,1);
  assert.equal(db.prepare("SELECT share_enabled FROM location_preferences WHERE user_id='friend'").get().share_enabled,0);
  assert.equal(db.prepare("SELECT analytics_enabled FROM location_preferences WHERE user_id='friend'").get().analytics_enabled,0);
  assert.equal(db.prepare("SELECT * FROM live_locations WHERE user_id='friend'").get(),undefined);
 }finally{db.close();}
});

test('rota do editor de cardápio abre diretamente após F5 e recusa URLs aleatórias',()=>{
 for(const url of ['/events/meaple-808-event-sorocaba-2026-11-07/menu','/events/id-exemplo/menu','/eventos/id-exemplo/cardapio']){
  assert.equal(isKnownAdminPath(url),true,url);
  const route=parseAdminRoute(url);
  assert.equal(route.section,'Eventos');
  assert.equal(route.menu,true);
  assert.equal(route.creating,false);
  assert.ok(route.id);
  assert.equal(adminRoutePath(route),'/events/'+encodeURIComponent(route.id)+'/menu');
 }
 for(const url of ['/events/id-exemplo/qualquer-coisa','/events/id-exemplo/menu/extra','/events/new/menu','/qualquer/rota']){
  assert.equal(isKnownAdminPath(url),false,url);
 }
 const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
 assert.match(shell,/const knownAdminRoute=isKnownAdminPath\(currentPath\)/);
 assert.match(shell,/:editing&&route.menu\?<section/);
 assert.match(shell,/<EventMenuEditor key=\{editing.id\} eventId=\{editing.id\} onBack=/);
});

test('novo evento inicia com compartilhamento permitido; desativação abre confirmação clara',()=>{
 const front=read('artifacts/submundo-808/src/components/admin-editors.tsx');
 const backend=read('server/index.mjs');
 assert.match(front,/useState\(event\?Number\(event.location_sharing_enabled\)===1:true\)/);
 assert.match(front,/if\(e.target.checked\)void changeLocationSharing\(true\);else\{setLocationError\(''\);setConfirmDisableLocation\(true\);\}/);
 assert.match(front,/role="alertdialog" aria-modal="true" aria-labelledby="disable-event-location-title"/);
 assert.match(front,/Desativar compartilhamento de localização\?/);
 assert.match(front,/A desativação será imediata/);
 assert.match(front,/O mapa 2D continuará disponível/);
 assert.match(front,/Confirmar desativação/);
 assert.match(front,/request\('set-event-location-sharing',\{id:event.id,enabled\}\)/);
 assert.match(front,/locationBusy\|\|saving/);
 assert.match(backend,/b.location_sharing_enabled!==false\?1:0/);
 assert.match(backend,/if\(req.method==='POST'&&key==='set-event-location-sharing'\)/);
 assert.match(backend,/typeof enabled!=='boolean'/);
 assert.match(backend,/applyEventLocationSharing\(db,id,enabled\)/);
 assert.match(backend,/if\(typeof b.location_sharing_enabled==='boolean'\)applyEventLocationSharing/);
});
