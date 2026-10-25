import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ensureDemoData} from '../server/demo-seed.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE venues(id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT DEFAULT '',city TEXT DEFAULT '',created_at INTEGER NOT NULL);
 CREATE TABLE venue_maps(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,gps_json TEXT DEFAULT '{}');
 CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL DEFAULT '[]');
 CREATE TABLE events(id TEXT PRIMARY KEY,venue_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT DEFAULT '',starts_at TEXT DEFAULT '',ends_at TEXT DEFAULT '',site_url TEXT DEFAULT '',tickets_url TEXT DEFAULT '',instagram_url TEXT DEFAULT '',lineup_json TEXT DEFAULT '[]',created_at INTEGER NOT NULL);
 CREATE TABLE event_maps(event_id TEXT NOT NULL,map_id TEXT NOT NULL,PRIMARY KEY(event_id,map_id));
 CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id));
 `);
 return db;
}
const count=(db,table)=>db.prepare('SELECT COUNT(*) count FROM '+table).get().count;

test('na primeira inicialização cria evento, 6 DJs, mapa, ambiente, pontos e 14 produtos',()=>{
 const db=fixture();
 try{
  const result=ensureDemoData(db,{now:1792944000000});
  assert.equal(result.created,true);
  assert.equal(result.productsCreated,14);
  for(const [table,n] of [['venues',1],['venue_maps',1],['map_areas',1],['map_markers',1],['events',1],['event_maps',1],['products',14],['event_products',14]]){
   assert.equal(count(db,table),n,table);
  }
  const event=db.prepare('SELECT lineup_json FROM events WHERE id=?').get(result.id);
  assert.equal(JSON.parse(event.lineup_json).length,6);
  const marker=db.prepare('SELECT markers_json FROM map_markers').get();
  assert.equal(JSON.parse(marker.markers_json).length,4);
  assert.equal(result.gpsStatus,'not-requested');
 }finally{db.close();}
});
test('reiniciar o servidor ou repetir o botão não duplica registros',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db);
  const second=ensureDemoData(db);
  assert.equal(second.id,first.id);
  assert.equal(second.created,false);
  assert.equal(second.productsCreated,0);
  assert.equal(second.productsLinked,0);
  assert.equal(count(db,'events'),1);
  assert.equal(count(db,'products'),14);
  assert.equal(count(db,'event_products'),14);
 }finally{db.close();}
});
test('renomear evento e personalizar produtos não é desfeito pelo seed automático',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db);
  db.prepare('UPDATE events SET name=? WHERE id=?').run('Evento renomeado pelo administrador',first.id);
  db.prepare('UPDATE products SET default_price_cents=? WHERE id=?').run(1399,'demo-product-agua-500');
  db.prepare('UPDATE event_products SET price_cents=? WHERE product_id=? AND event_id=?').run(1199,'demo-product-agua-500',first.id);
  const again=ensureDemoData(db);
  assert.equal(again.id,first.id);
  assert.equal(again.created,false);
  assert.equal(db.prepare('SELECT name FROM events WHERE id=?').get(first.id).name,'Evento renomeado pelo administrador');
  assert.equal(db.prepare('SELECT default_price_cents FROM products WHERE id=?').get('demo-product-agua-500').default_price_cents,1399);
  assert.equal(db.prepare('SELECT price_cents FROM event_products WHERE event_id=? AND product_id=?').get(first.id,'demo-product-agua-500').price_cents,1199);
 }finally{db.close();}
});
test('complementa apenas produtos ausentes sem restaurar os valores personalizados',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db);
  db.prepare('DELETE FROM event_products WHERE product_id=?').run('demo-product-suco');
  const second=ensureDemoData(db);
  assert.equal(second.productsLinked,1);
  assert.equal(count(db,'event_products'),14);
  assert.equal(second.id,first.id);
 }finally{db.close();}
});
test('GPS não é solicitado no boot e calibração manual não é sobrescrita quando acionada pelo admin',()=>{
 const db=fixture();
 try{
  const first=ensureDemoData(db);
  db.prepare('UPDATE map_areas SET gps_json=?').run(JSON.stringify({tl:{lat:-23.5,lng:-46.6,accuracy:5}}));
  const second=ensureDemoData(db,{location:{latitude:-23.5,longitude:-46.6,accuracy:6}});
  assert.equal(second.id,first.id);
  assert.equal(second.gpsStatus,'manual-preserved');
  const saved=JSON.parse(db.prepare('SELECT gps_json FROM map_areas').get().gps_json);
  assert.deepEqual(saved,{tl:{lat:-23.5,lng:-46.6,accuracy:5}});
 }finally{db.close();}
});
