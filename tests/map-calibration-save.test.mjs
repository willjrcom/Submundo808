import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {prepareMapCalibration,saveMapCalibration,CALIBRATION_MARGIN_METERS} from '../server/map-calibration-save.mjs';
import {buildManualCalibration} from '../artifacts/submundo-808/src/components/map-calibration-manual.ts';

const values={
 tl:{lat:'-23.450000',lng:'-47.400000'},
 tr:{lat:'-23.450000',lng:'-47.399000'},
 bl:{lat:'-23.451000',lng:'-47.400000'},
 br:{lat:'-23.451000',lng:'-47.399000'}
};
const valid=buildManualCalibration(values,'4');
assert.ok(valid.ok);

function dbFixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE venue_maps(id TEXT PRIMARY KEY); CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,name TEXT NOT NULL,x REAL NOT NULL,gps_json TEXT NOT NULL); CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL)");
 db.prepare('INSERT INTO venue_maps(id) VALUES(?)').run('map-a');
 db.prepare('INSERT INTO venue_maps(id) VALUES(?)').run('map-b');
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?)').run('area-a','map-a','Pista',10,'{}');
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?)').run('area-b','map-a','VIP',42,'{"legacy":true}');
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?)').run('area-c','map-b','Outra planta',5,'{"other":true}');
 db.prepare('INSERT INTO map_markers VALUES(?,?)').run('map-a','[{"name":"Bar"}]');
 return db;
}
test('um único Aplicar calibração persiste apenas GPS, mantendo rascunhos de ambientes e marcadores separados',()=>{
 const db=dbFixture();
 try{
  const result=saveMapCalibration(db,{mapId:'map-a',areaId:'area-a',rawCorners:valid.raw});
  assert.equal(result.ok,true);
  assert.equal(result.gps.marginMeters,CALIBRATION_MARGIN_METERS);
  assert.equal(result.gps.origin,'coordinates');
  assert.equal(result.gps.rawCorners.tl.lat,valid.raw.tl.lat);
  const room=db.prepare('SELECT name,x,gps_json FROM map_areas WHERE id=?').get('area-a');
  assert.equal(room.name,'Pista');assert.equal(room.x,10);
  const saved=JSON.parse(room.gps_json);
  assert.equal(saved.mode,'manual');assert.equal(saved.marginMeters,5);
  assert.ok(Math.abs(saved.tl.lat-saved.rawCorners.tl.lat)>0);
  assert.deepEqual(JSON.parse(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-b').gps_json),{});
  assert.deepEqual(JSON.parse(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-c').gps_json),{other:true});
  assert.equal(db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get('map-a').markers_json,'[{"name":"Bar"}]');
  assert.equal(db.prepare('SELECT x FROM map_areas WHERE id=?').get('area-b').x,42);
 }finally{db.close();}
});
test('o servidor reconstrói a margem a partir das coordenadas brutas sem aceitar GPS pronto do cliente',()=>{
 const gps=prepareMapCalibration(valid.raw);
 assert.ok(gps);
 assert.equal(gps.marginMeters,5);
 for(const key of ['tl','tr','bl','br']){
  assert.ok(Math.abs(gps[key].lat-valid.gps[key].lat)<1e-8);
  assert.ok(Math.abs(gps[key].lng-valid.gps[key].lng)<1e-8);
 }
});
test('coordenadas cruzadas, fora de alcance ou incompletas não alteram a calibração',()=>{
 const db=dbFixture();
 try{
  const bad=[
   {...valid.raw,br:valid.raw.bl,bl:valid.raw.br},
   {...valid.raw,tl:{lat:91,lng:0,accuracy:0}},
   {...valid.raw,bl:undefined},
   {...valid.raw,tl:{lat:NaN,lng:-47.4,accuracy:0}}
  ];
  for(const rawCorners of bad){
   const response=saveMapCalibration(db,{mapId:'map-a',areaId:'area-a',rawCorners});
   assert.equal(response.ok,false);
   assert.equal(response.status,400);
  }
  assert.equal(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-a').gps_json,'{}');
  assert.equal(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-b').gps_json,'{"legacy":true}');
 }finally{db.close();}
});
test('não é possível alterar um ambiente que não pertence ao mapa',()=>{
 const db=dbFixture();
 try{
  const result=saveMapCalibration(db,{mapId:'map-a',areaId:'area-c',rawCorners:valid.raw});
  assert.equal(result.ok,false);assert.equal(result.status,404);
  assert.equal(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-c').gps_json,'{"other":true}');
  assert.equal(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('area-b').gps_json,'{"legacy":true}');
 }finally{db.close();}
});
test('a API exclusiva exige autorização administrativa e não passa por save-layout',()=>{
 const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const admin=server.indexOf("if(url.pathname.startsWith('/api/admin/'))");
 const route=server.indexOf("key==='save-calibration'");
 const fullLayout=server.indexOf("key==='save-layout'");
 assert.ok(admin>=0,'rota precisa estar protegida sob /api/admin');
 assert.ok(route>admin&&route<fullLayout);
 assert.match(server,/saveMapCalibration\(db,\{mapId:b\.map_id,areaId:b\.area_id,rawCorners:b\.raw_corners\}\)/);
});
