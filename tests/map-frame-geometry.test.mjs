import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MAP_FRAME,validMapFrame,normalizeMapFrame,moveMapFrame,resizeMapFrame,mapFrameAspect} from '../artifacts/submundo-808/src/components/map-frame-geometry.ts';

test('existing maps fall back to the previous 22%/56% editing area',()=>{
 assert.deepEqual(normalizeMapFrame(undefined),{x:22,y:22,width:56,height:56});
 assert.deepEqual(normalizeMapFrame({x:0,y:0,width:5,height:100}),DEFAULT_MAP_FRAME);
 assert.equal(validMapFrame(DEFAULT_MAP_FRAME),true);
});
test('frame moves independently of the stored rooms and markers',()=>{
 const room={x:-20,y:15,width:30,height:35};
 const moved=moveMapFrame(DEFAULT_MAP_FRAME,10,-7);
 assert.deepEqual(moved,{x:32,y:15,width:56,height:56});
 assert.deepEqual(room,{x:-20,y:15,width:30,height:35});
});
test('map frame cannot be dragged out of pasteboard',()=>{
 assert.deepEqual(moveMapFrame(DEFAULT_MAP_FRAME,-90,90),{x:0,y:44,width:56,height:56});
});
test('resize each of four sides and preserve opposite side',()=>{
 const f=DEFAULT_MAP_FRAME;
 assert.deepEqual(resizeMapFrame(f,'left',-10,0),{x:12,y:22,width:66,height:56});
 assert.deepEqual(resizeMapFrame(f,'right',9,0),{x:22,y:22,width:65,height:56});
 assert.deepEqual(resizeMapFrame(f,'top',0,-12),{x:22,y:10,width:56,height:68});
 assert.deepEqual(resizeMapFrame(f,'bottom',0,8),{x:22,y:22,width:56,height:64});
});
test('all corner handles act on both axes',()=>{
 const f=DEFAULT_MAP_FRAME;
 assert.deepEqual(resizeMapFrame(f,'tl',-5,-7),{x:17,y:15,width:61,height:63});
 assert.deepEqual(resizeMapFrame(f,'tr',5,-7),{x:22,y:15,width:61,height:63});
 assert.deepEqual(resizeMapFrame(f,'bl',-5,7),{x:17,y:22,width:61,height:63});
 assert.deepEqual(resizeMapFrame(f,'br',5,7),{x:22,y:22,width:61,height:63});
});
test('map cannot shrink beyond minimum size or become inverted',()=>{
 const a=resizeMapFrame(DEFAULT_MAP_FRAME,'left',300,0);
 assert.equal(a.width,18);
 assert.equal(a.x+a.width,78);
 const b=resizeMapFrame(DEFAULT_MAP_FRAME,'br',1000,1000);
 assert.equal(b.x+b.width,100);assert.equal(b.y+b.height,100);
});
test('public map aspect reflects edited frame dimensions',()=>{
 assert.equal(mapFrameAspect(DEFAULT_MAP_FRAME),4/3);
 assert.equal(mapFrameAspect({x:10,y:20,width:60,height:40}),2);
});
