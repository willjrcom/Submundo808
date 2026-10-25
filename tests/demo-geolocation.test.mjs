import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {
 DEMO_WIDTH_METERS,DEMO_HEIGHT_METERS,DEMO_SPACING_METERS,DEMO_MARKERS,
 validateDemoLocation,buildDemoBounds,applyDemoCalibration
} from '../server/demo-geolocation.mjs';

const location={latitude:-23.5505,longitude:-46.6333,accuracy:8};
const sampleLegacyMarkers=[
 {id:'bar',name:'Bar principal',type:'bar',x:20,y:25},
 {id:'bath',name:'Banheiros',type:'banheiro',x:78,y:30},
 {id:'stage',name:'Palco',type:'palco',x:45,y:12},
 {id:'entrance',name:'Entrada',type:'entrada',x:45,y:90}
];
function fixture(gps={}){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT NOT NULL,gps_json TEXT NOT NULL)');
 db.exec('CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT NOT NULL)');
 db.prepare('INSERT INTO map_areas VALUES(?,?,?)').run('zone-1','map-1',JSON.stringify(gps));
 db.prepare('INSERT INTO map_markers VALUES(?,?)').run('map-1',JSON.stringify(sampleLegacyMarkers));
 return db;
}
function savedGps(db){
 return JSON.parse(db.prepare('SELECT gps_json FROM map_areas WHERE id=?').get('zone-1').gps_json);
}
function savedMarkers(db){
 return JSON.parse(db.prepare('SELECT markers_json FROM map_markers WHERE map_id=?').get('map-1').markers_json);
}
function meters(a,b){const scaleX=111320*Math.cos(location.latitude*Math.PI/180);return Math.hypot((a.lng-b.lng)*scaleX,(a.lat-b.lat)*111320);}
test('calibração gerada tem 50 × 40 m, orientada a norte e com centro no GPS obtido',()=>{
 const gps=buildDemoBounds(location,123);
 assert.equal(gps.mode,'demo-auto');
 assert.equal(gps.spacingMeters,10);
 assert.equal(gps.generatedAt,123);
 assert.ok(Math.abs(meters(gps.tl,gps.tr)-DEMO_WIDTH_METERS)<0.15);
 assert.ok(Math.abs(meters(gps.tl,gps.bl)-DEMO_HEIGHT_METERS)<0.15);
 assert.ok(Math.abs((gps.tl.lat+gps.br.lat)/2-location.latitude)<0.000001);
 assert.ok(Math.abs((gps.tl.lng+gps.br.lng)/2-location.longitude)<0.000001);
 assert.equal(gps.accuracyMeters,8);
});
test('pontos novos usam grade onde vizinhos estão separados por 10 metros',()=>{
 assert.equal(DEMO_MARKERS.length,4);
 const toMeters=m=>({x:m.x/100*DEMO_WIDTH_METERS,y:m.y/100*DEMO_HEIGHT_METERS});
 const points=DEMO_MARKERS.map(toMeters);
 assert.ok(Math.abs(Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)-DEMO_SPACING_METERS)<1e-9);
 assert.ok(Math.abs(Math.hypot(points[0].x-points[2].x,points[0].y-points[2].y)-DEMO_SPACING_METERS)<1e-9);
 assert.ok(DEMO_MARKERS.every(p=>p.shape==='square'));
});
test('GPS automático reconfigura a demonstração existente e reorganiza somente os pontos originais',()=>{
 const db=fixture();
 try{
  const outcome=applyDemoCalibration(db,'map-1',location,123);
  assert.equal(outcome.gpsStatus,'auto-calibrated');
  assert.equal(outcome.markersRepositioned,true);
  assert.equal(savedGps(db).mode,'demo-auto');
  const points=savedMarkers(db);
  assert.ok(points.every(p=>DEMO_MARKERS.some(expected=>expected.name===p.name&&expected.x===p.x&&expected.y===p.y)));
 }finally{db.close();}
});
test('GPS automático pode ser atualizado quando já foi gerado automaticamente',()=>{
 const db=fixture();
 try{
  applyDemoCalibration(db,'map-1',location,123);
  const newLocation={...location,latitude:location.latitude+0.001};
  const refreshed=applyDemoCalibration(db,'map-1',newLocation,456);
  assert.equal(refreshed.gpsStatus,'auto-calibrated');
  assert.equal(refreshed.markersRepositioned,false);
  assert.equal(savedGps(db).generatedAt,456);
  assert.ok(savedGps(db).tl.lat>location.latitude);
 }finally{db.close();}
});
test('um único canto calibrado manualmente impede sobrescrever o mapa',()=>{
 const manual={tl:{lat:-23.55,lng:-46.63,accuracy:3}};
 const db=fixture(manual);
 try{
  const outcome=applyDemoCalibration(db,'map-1',location);
  assert.equal(outcome.gpsStatus,'manual-preserved');
  assert.deepEqual(savedGps(db),manual);
  assert.deepEqual(savedMarkers(db),sampleLegacyMarkers);
 }finally{db.close();}
});
test('GPS manual com metadado explícito também é preservado',()=>{
 const manual={mode:'manual',tr:{lat:-23.55,lng:-46.63,accuracy:3}};
 const db=fixture(manual);
 try{
  assert.equal(applyDemoCalibration(db,'map-1',location).gpsStatus,'manual-preserved');
  assert.deepEqual(savedGps(db),manual);
 }finally{db.close();}
});
test('pontos existentes alterados manualmente nunca são reposicionados',()=>{
 const db=fixture();
 try{
  const points=savedMarkers(db);
  points[0].x=21;
  db.prepare('UPDATE map_markers SET markers_json=? WHERE map_id=?').run(JSON.stringify(points),'map-1');
  const status=applyDemoCalibration(db,'map-1',location);
  assert.equal(status.gpsStatus,'auto-calibrated');
  assert.equal(status.markersRepositioned,false);
  assert.deepEqual(savedMarkers(db),points);
 }finally{db.close();}
});
test('sem consentimento para localização a demonstração não modifica GPS nem pontos',()=>{
 const db=fixture();
 try{
  assert.equal(applyDemoCalibration(db,'map-1',null).gpsStatus,'not-requested');
  assert.deepEqual(savedGps(db),{});
  assert.deepEqual(savedMarkers(db),sampleLegacyMarkers);
 }finally{db.close();}
});
test('rejeita GPS inválido em vez de criar cantos geograficamente incorretos',()=>{
 for(const input of [{latitude:100,longitude:0,accuracy:5},{latitude:-23,longitude:-46,accuracy:-1},{latitude:NaN,longitude:-46,accuracy:5},{latitude:-23,longitude:Infinity,accuracy:5}]){
  assert.throws(()=>validateDemoLocation(input));
 }
});
