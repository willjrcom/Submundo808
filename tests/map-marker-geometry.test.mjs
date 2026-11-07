import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorMarker,changeMarkerType,closestMapEdge,freeMarker,moveMarker,normalizeMarker,positionOnEdge} from '../artifacts/submundo-808/src/components/map-marker-geometry.ts';

test('entrance from an older map becomes anchored to its nearest edge',()=>{
 const marker=normalizeMarker({type:'entrada',name:'Entrada',x:43,y:93});
 assert.equal(marker.anchor.side,'bottom');
 assert.equal(marker.anchor.offset,43);
 assert.deepEqual([marker.x,marker.y],[43,100]);
});
test('entrances can be placed independently on any of the four sides',()=>{
 const cases=[['top',50,0],['right',100,50],['bottom',50,100],['left',0,50]];
 for(const [side,x,y] of cases){
  const marker=anchorMarker({type:'entrada',name:'Entrada',x:50,y:50},side);
  assert.deepEqual([marker.x,marker.y],[x,y]);
 }
});
test('anchored marker moves only along the chosen border',()=>{
 const onRight=anchorMarker({type:'entrada',x:50,y:50},'right');
 const moved=moveMarker(onRight,-80,84);
 assert.deepEqual([moved.x,moved.y],[100,84]);
 const top=anchorMarker({type:'palco',x:60,y:40},'top');
 const dragged=moveMarker(top,-20,70);
 assert.deepEqual([dragged.x,dragged.y],[0,0]);
 assert.equal(dragged.anchor.offset,0);
});
test('switching border does not jump to a corner',()=>{
 const top=anchorMarker({type:'palco',x:67,y:0},'top');
 const right=anchorMarker(top,'right');
 assert.deepEqual([right.x,right.y],[100,67]);
 const bottom=anchorMarker(right,'bottom');
 assert.deepEqual([bottom.x,bottom.y],[67,100]);
});
test('stage keeps its point icon but may freely leave the border',()=>{
 const stage=anchorMarker({type:'palco',name:'Palco',x:40,y:40},'top');
 assert.equal(stage.type,'palco');
 const free=freeMarker(stage);
 assert.equal(free.anchor,undefined);
 const moved=moveMarker(free,64,34);
 assert.deepEqual([moved.x,moved.y],[64,34]);
 assert.equal(moved.type,'palco');
});
test('changing icon to entrance anchors it; converting away frees it',()=>{
 const original={type:'outro',name:'Ponto',x:10,y:49};
 const entry=changeMarkerType(original,'entrada');
 assert.equal(entry.anchor.side,'left');
 assert.equal(entry.x,0);
 const stage=changeMarkerType(entry,'palco');
 assert.equal(stage.anchor,undefined);
 assert.equal(stage.type,'palco');
});
test('two entrances are unrelated and can share a side',()=>{
 const left=moveMarker(anchorMarker({id:'a',type:'entrada',x:50,y:30},'left'),9,12);
 const another=moveMarker(anchorMarker({id:'b',type:'entrada',x:50,y:70},'left'),32,82);
 assert.deepEqual([left.x,left.y],[0,12]);
 assert.deepEqual([another.x,another.y],[0,82]);
});

import {associateMarkerWithRoom,anchorMarkerInRoom,bindMarkerToRoom,moveMarkerInRooms,moveRoomMarkers,roomContainingPoint,positionOnRoomEdge} from '../artifacts/submundo-808/src/components/map-marker-geometry.ts';

test('room-edge anchors use room geometry, not global 0..100 map edges',()=>{
 const room={id:'pista',x:15,y:20,width:60,height:50};
 const m=anchorMarkerInRoom({id:'bar',type:'bar',x:43,y:42},room,'top',50);
 assert.equal(m.area_id,'pista');
 assert.deepEqual([m.x,m.y],[45,20]);
 assert.equal(m.anchor.scope,'area');
 assert.deepEqual(positionOnRoomEdge(room,'right',40),{x:75,y:40});
});
test('marker follows room move and resize proportionally',()=>{
 const old=[{id:'a',x:10,y:20,width:40,height:40}], next=[{id:'a',x:20,y:30,width:60,height:20}];
 const markers=[{id:'bar',type:'bar',x:30,y:40,area_id:'a'},{id:'edge',type:'entrada',x:50,y:40,area_id:'a',anchor:{side:'right',offset:50,scope:'area'}}];
 const moved=moveRoomMarkers(markers,old,next);
 assert.deepEqual([moved[0].x,moved[0].y],[50,40]);
 assert.deepEqual([moved[1].x,moved[1].y],[80,40]);
});
test('individual point motion can reassign to another room and room edge remains constrained',()=>{
 const rooms=[{id:'a',x:0,y:0,width:40,height:50},{id:'b',x:40,y:0,width:60,height:50}];
 const moved=moveMarkerInRooms({type:'bar',x:20,y:20,area_id:'a'},65,30,rooms);
 assert.equal(moved.area_id,'b');
 const fixed=anchorMarkerInRoom({type:'bar',x:20,y:20},rooms[0],'top',20);
 const dragged=moveMarkerInRooms(fixed,200,30,rooms);
 assert.equal(dragged.x,40);
 assert.equal(dragged.y,0);
});
test('legacy markers inside a room are associated, while map entrances are preserved',()=>{
 const rooms=[{id:'a',x:10,y:10,width:40,height:40}];
 assert.equal(roomContainingPoint(rooms,20,20).id,'a');
 assert.equal(associateMarkerWithRoom({type:'bar',x:20,y:20},rooms).area_id,'a');
 const entry=normalizeMarker({type:'entrada',x:50,y:0});
 assert.equal(associateMarkerWithRoom(entry,rooms).area_id,undefined);
 const bound=bindMarkerToRoom({type:'bar',x:99,y:99},rooms[0]);
 assert.deepEqual([bound.x,bound.y],[30,30]);
});
test('passages follow a shared boundary when rooms are resized together',()=>{
 const before=[{id:'a',x:0,y:0,width:40,height:60},{id:'b',x:40,y:0,width:60,height:60}];
 const after=[{...before[0],width:50},{...before[1],x:50,width:50}];
 const moved=moveRoomMarkers([{id:'door',type:'passagem',from_area_id:'a',to_area_id:'b',x:40,y:30}],before,after)[0];
 assert.deepEqual([moved.x,moved.y],[50,30]);
});
test('ellipse edge anchor lies on ellipse boundary',()=>{
 const room={id:'circle',x:10,y:15,width:40,height:30,geometry:{shape:'ellipse'}};
 const a=anchorMarkerInRoom({type:'bar',x:24,y:20},room,'top',20);
 const dx=(a.x-30)/20,dy=(a.y-30)/15;
 assert.ok(Math.abs(dx*dx+dy*dy-1)<1e-9);
});
