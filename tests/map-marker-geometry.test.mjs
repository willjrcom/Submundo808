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
