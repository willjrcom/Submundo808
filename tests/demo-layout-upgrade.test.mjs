import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {updateUntouchedDemoLayout} from '../server/demo-seed.mjs';
import {DEMO_MARKERS} from '../server/demo-geolocation.mjs';

const older=[
 {id:'bar',name:'Bar principal',type:'bar',x:40,y:37.5},
 {id:'wc',name:'Banheiros',type:'banheiro',x:60,y:37.5},
 {id:'stage',name:'Palco',type:'palco',x:40,y:62.5},
 {id:'door',name:'Entrada',type:'entrada',x:60,y:62.5}
];
function fixture(markers=older,gps={}){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE map_areas(id TEXT PRIMARY KEY,map_id TEXT,name TEXT,x REAL,y REAL,width REAL,height REAL,gps_json TEXT)");
 db.exec("CREATE TABLE map_markers(map_id TEXT PRIMARY KEY,markers_json TEXT)");
 db.prepare('INSERT INTO map_areas VALUES(?,?,?,?,?,?,?,?)').run('room','map','Pista principal',8,10,75,75,JSON.stringify(gps));
 db.prepare('INSERT INTO map_markers VALUES(?,?)').run('map',JSON.stringify(markers));
 return db;
}
const points=db=>JSON.parse(db.prepare('SELECT markers_json FROM map_markers').get().markers_json);

test('old untouched map adopts the 5 default POIs and upper-half room',()=>{
 const db=fixture();
 try{
  assert.equal(updateUntouchedDemoLayout(db,'map'),true);
  assert.equal(points(db).length,5);
  assert.ok(DEMO_MARKERS.every(p=>points(db).some(q=>q.name===p.name&&q.x===p.x&&q.y===p.y)));
  assert.equal(points(db).find(p=>p.name==='Bar principal').id,'bar');
  assert.deepEqual(db.prepare('SELECT x,y,width,height FROM map_areas').get(),{x:0,y:0,width:100,height:55});
  assert.equal(updateUntouchedDemoLayout(db,'map'),false);
 }finally{db.close();}
});
test('manual layout changes block automatic upgrade',()=>{
 const changed=older.map(p=>({...p}));
 changed[1].y=38;
 const db=fixture(changed);
 try{
  assert.equal(updateUntouchedDemoLayout(db,'map'),false);
  assert.deepEqual(points(db),changed);
 }finally{db.close();}
});
test('partial or complete manual GPS calibration blocks automatic upgrade',()=>{
 const db=fixture(older,{tl:{lat:-23.5,lng:-46.6,accuracy:4}});
 try{
  assert.equal(updateUntouchedDemoLayout(db,'map'),false);
  assert.equal(points(db).length,4);
 }finally{db.close();}
});
test('other extra POIs are never erased',()=>{
 const custom=[...older,{id:'extra',name:'Tenda de comida',type:'alimentacao',x:40,y:80}];
 const db=fixture(custom);
 try{
  assert.equal(updateUntouchedDemoLayout(db,'map'),false);
  assert.equal(points(db).length,5);
 }finally{db.close();}
});
