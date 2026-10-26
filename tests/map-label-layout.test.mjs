import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutRoomLabels} from '../artifacts/submundo-808/src/components/map-label-layout.ts';

const rooms=[
 {id:'vip',name:'Área VIP',x:0,y:0,width:100,height:48},
 {id:'pista',name:'Pista',x:0,y:48,width:100,height:52}
];
const markers=[
 {name:'Palco',x:50,y:0,size:42},
 {name:'Bar principal',x:10,y:48,size:42},
 {name:'Banheiros',x:90,y:48,size:42},
 {name:'Bar de cerveja',x:12,y:75,size:42},
 {name:'Entrada',x:50,y:100,size:42}
];
test('each VIP and dancefloor label receives a unique position inside its room',()=>{
 const result=layoutRoomLabels(rooms,markers,700,525);
 assert.equal(result.length,2);
 assert.equal(result[0].id,'vip');
 assert.equal(result[1].id,'pista');
 for(const label of result){
  const room=rooms.find(r=>r.id===label.id);
  assert.ok(label.x>=room.x&&label.x<=room.x+room.width);
  assert.ok(label.y>=room.y&&label.y<=room.y+room.height);
 }
});
test('a centered point makes the room title move away from the center',()=>{
 const room=[{id:'a',name:'Área VIP',x:0,y:0,width:100,height:100}];
 const labels=layoutRoomLabels(room,[{name:'Palco',x:50,y:50,size:70}],600,450);
 const label=labels[0];
 assert.ok(Math.abs(label.x-50)>8||Math.abs(label.y-50)>8);
});
test('label placement is deterministic and recalculated for mobile width',()=>{
 const desktop=layoutRoomLabels(rooms,markers,700,525);
 const again=layoutRoomLabels(rooms,markers,700,525);
 const mobile=layoutRoomLabels(rooms,markers,320,240);
 assert.deepEqual(desktop,again);
 assert.equal(mobile.length,2);
 assert.ok(mobile.every(({x,y})=>Number.isFinite(x)&&Number.isFinite(y)));
});
test('no points at all still leaves a readable room title',()=>{
 const result=layoutRoomLabels(rooms,[],320,240);
 assert.deepEqual(result.map(l=>l.id),['vip','pista']);
});
