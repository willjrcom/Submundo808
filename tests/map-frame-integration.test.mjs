import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {DEMO_MARKERS} from '../server/demo-geolocation.mjs';

const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
const editor=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');
const participant=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('migrates old venue_maps non-destructively with a default frame',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL)");
  db.prepare('INSERT INTO venue_maps VALUES(?,?,?,?)').run('m','v','My existing map',1);
  db.exec("ALTER TABLE venue_maps ADD COLUMN frame_json TEXT NOT NULL DEFAULT '{\"x\":22,\"y\":22,\"width\":56,\"height\":56}'");
  const row=db.prepare('SELECT * FROM venue_maps').get();
  assert.deepEqual(JSON.parse(row.frame_json),{x:22,y:22,width:56,height:56});
  db.prepare('UPDATE venue_maps SET frame_json=? WHERE id=?').run(JSON.stringify({x:15,y:10,width:70,height:80}),'m');
  assert.deepEqual(JSON.parse(db.prepare('SELECT frame_json FROM venue_maps').get().frame_json),{x:15,y:10,width:70,height:80});
  assert.equal(db.prepare('SELECT name FROM venue_maps').get().name,'My existing map');
 }finally{db.close();}
});
test('backend validates and persists frame atomically with rooms and POIs',()=>{
 assert.match(server,/ALTER TABLE venue_maps ADD COLUMN frame_json/);
 assert.match(server,/if\(frame!==undefined&&!isValidMapFrame\(frame\)\)/);
 assert.match(server,/UPDATE venue_maps SET frame_json=\? WHERE id=\?/);
 assert.match(server,/if\(frame!==undefined\)db\.prepare/);
 assert.match(server,/db\.exec\('COMMIT'\)/);
});
test('all map read routes return the frame and the participant uses its aspect',()=>{
 assert.match(server,/frame:frameOf\(map\)/);
 assert.match(server,/frame:frameOf\(row\)/);
 assert.match(participant,/mapFrameAspect\(normalizeMapFrame\(data\?\.map\.frame\)\)/);
});
test('editor can drag and resize frame using 8 handles, with undo and redo',()=>{
 assert.match(editor,/Editar área do mapa/);
 assert.match(editor,/startFrameDrag\(e,'frame-move'\)/);
 assert.match(editor,/startFrameDrag\(e,'frame-resize',handle\)/);
 assert.match(editor,/\['tl','0%','0%'\]/);
 assert.match(editor,/\['br','100%','100%'\]/);
 assert.match(editor,/setFrame\(resizeMapFrame\(/);
 assert.match(editor,/setFrame\(moveMapFrame\(/);
 assert.match(editor,/setFrame\(previous\.frame\)/);
 assert.match(editor,/setFrame\(next\.frame\)/);
 assert.match(editor,/api\('save-layout',\{map_id:map\.id,areas,markers,frame\}\)/);
});
test('snap toggle applies during resize, and rooms still snap to external map border',()=>{
 assert.match(editor,/resizeShared\(d\.snapshot\.areas,d\.id,d\.edge,delta,snap\)/);
});
test('new maps start with arranged POIs and two bars',()=>{
 assert.equal(DEMO_MARKERS.length,5);
 const names=DEMO_MARKERS.map(m=>m.name);
 assert.deepEqual([...names].sort(),['Palco','Bar principal','Banheiros','Entrada','Bar de cerveja'].sort());
 assert.match(server,/JSON\.stringify\(DEMO_MARKERS\.map\(marker=>\(\{\.\.\.marker,id:randomUUID\(\)\}\)\)\)/);
});
