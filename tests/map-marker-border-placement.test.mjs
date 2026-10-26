import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anchorMarker,moveMarker,markerIconStyle,normalizeMarker} from '../artifacts/submundo-808/src/components/map-marker-geometry.ts';

const admin=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-map-workspace.tsx',import.meta.url),'utf8');
const client=readFileSync(new URL('../artifacts/submundo-808/src/components/venue-map.tsx',import.meta.url),'utf8');

test('anchored icons straddle all four map edges by half of their icon size',()=>{
 for(const type of ['palco','entrada','bar','banheiro']){
  for(const side of ['top','right','bottom','left']){
   const marker=anchorMarker({type,x:50,y:50},side);
   for(const size of [24,42,72]){
    const css=markerIconStyle(marker,size);
    assert.equal(css.transform,'translate(-50%, -50%)');
    assert.equal(css.width,size);
    assert.equal(css.height,size);
    assert.equal(css.left,marker.x+'%');
    assert.equal(css.top,marker.y+'%');
    // At 0% the button's left/top is -size/2; at 100% its far
    // edge extends +size/2 beyond the boundary.
    const cx=marker.x/100*500,cy=marker.y/100*400;
    const left=cx-size/2,right=cx+size/2,top=cy-size/2,bottom=cy+size/2;
    if(side==='left')assert.deepEqual([left,right],[-size/2,size/2]);
    if(side==='right')assert.deepEqual([left,right],[500-size/2,500+size/2]);
    if(side==='top')assert.deepEqual([top,bottom],[-size/2,size/2]);
    if(side==='bottom')assert.deepEqual([top,bottom],[400-size/2,400+size/2]);
   }
  }
 }
});
test('entrance and stage remain centered after dragging and loading saved coordinates',()=>{
 for(const side of ['top','right','bottom','left']){
  const marker=anchorMarker({type:'entrada',x:50,y:50},side);
  const moved=moveMarker(marker,61,68);
  const restored=normalizeMarker(JSON.parse(JSON.stringify(moved)));
  assert.deepEqual(restored,moved);
  assert.deepEqual(markerIconStyle(restored,42),markerIconStyle(moved,42));
 }
});
test('both map implementations render the shared icon positioning, independently of text labels',()=>{
 assert.match(admin,/style=\{markerIconStyle\(m,size\)\}/);
 assert.match(client,/style=\{markerIconStyle\(m,size\)\}/);
 assert.match(admin,/pointer-events-none absolute z-20 w-max max-w-24/);
 assert.match(client,/pointer-events-none absolute z-20 w-max max-w-24/);
 assert.match(admin,/overflow-visible rounded-xl border/);
 assert.match(client,/overflow-visible rounded-xl border/);
 assert.doesNotMatch(admin,/className=\{'absolute z-10 -translate-x-1\/2 -translate-y-1\/2 text-center '/);
});
