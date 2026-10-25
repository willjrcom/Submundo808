import test from 'node:test';
import assert from 'node:assert/strict';
import {intersects,sharesBorder,resizeShared,moveArea,freeAreaPosition} from '../artifacts/submundo-808/src/components/map-layout-geometry.ts';

const left={id:'pista',x:0,y:0,width:60,height:100};
const right={id:'vip',x:60,y:0,width:40,height:100};
test('border sharing is not considered overlap',()=>{
 assert.equal(sharesBorder(left,right),true);
 assert.equal(intersects(left,right),false);
});
test('shared right border resizes both adjacent rooms',()=>{
 const result=resizeShared([left,right],'pista','right',10);
 assert.deepEqual([result[0].width,result[1].x,result[1].width],[70,70,30]);
 assert.equal(sharesBorder(result[0],result[1]),true);
});
test('shared border resizes multiple neighbors at a T-junction',()=>{
 const a={id:'a',x:0,y:0,width:50,height:100};
 const b={id:'b',x:50,y:0,width:50,height:40};
 const c={id:'c',x:50,y:40,width:50,height:60};
 const out=resizeShared([a,b,c],'a','right',8);
 assert.deepEqual(out.map(x=>[x.x,x.width]),[[0,58],[58,42],[58,42]]);
});
test('shared border cannot shrink a room below minimum size',()=>{
 assert.equal(resizeShared([left,right],'pista','right',38)[0].width,60);
 assert.equal(resizeShared([left,right],'pista','left',-58)[0].width,60);
});
test('moving one environment does not move its neighbors',()=>{
 const moved=moveArea([{...left,x:10,width:40,height:40},{...right,x:50,width:30,height:40}],'pista',20,10,false);
 assert.deepEqual(moved.map(x=>[x.x,x.y]),[[20,10],[50,0]]);
});
test('room can be parked outside original canvas and returned later',()=>{
 const original=[{id:'a',x:10,y:10,width:20,height:20},{id:'b',x:30,y:10,width:20,height:20}];
 const outside=moveArea(original,'a',-25,-25,false);
 assert.deepEqual([outside[0].x,outside[0].y,outside[1].x],[-25,-25,30]);
 const returned=moveArea(outside,'a',10,10,true);
 assert.deepEqual([returned[0].x,returned[0].y],[10,10]);
 assert.equal(sharesBorder(returned[0],returned[1]),true);
});
test('dragging inside a neighbor is allowed while rearranging layout',()=>{
 const a={id:'a',x:0,y:0,width:20,height:20};
 const b={id:'b',x:45,y:45,width:20,height:20};
 const result=moveArea([a,b],'a',50,50,false);
 assert.equal(result[0].x,50);
 assert.equal(intersects(result[0],result[1]),true);
});
test('area outside map can be resized and later returned',()=>{
 const rooms=[{id:'a',x:-20,y:5,width:20,height:20}];
 const resized=resizeShared(rooms,'a','right',10);
 assert.equal(resized[0].width,30);
 assert.equal(moveArea(resized,'a',15,5,false)[0].x,15);
});
test('pasteboard prevents rooms being lost far offscreen',()=>{
 const a={id:'a',x:10,y:10,width:20,height:20};
 const result=moveArea([a],'a',-100,200,false);
 assert.deepEqual([result[0].x,result[0].y],[-35,115]);
});
test('new area is positioned next to existing boundaries',()=>{
 const p=freeAreaPosition([{id:'a',x:10,y:10,width:30,height:30}],20,20);
 assert.ok(p);
 assert.equal(p.x,40);
 assert.equal(p.y,10);
});
