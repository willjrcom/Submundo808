import test from 'node:test';
import assert from 'node:assert/strict';
import {stableGps,distanceMeters,gpsToMap,offMapInfo,mapSize} from '../artifacts/submundo-808/src/components/map-location-utils.ts';

const deltaLat=m=>m/111320;
const deltaLng=(m,lat=-23.55)=>m/(111320*Math.cos(lat*Math.PI/180));
const origin={lat:-23.55,lng:-46.63};
const bounds={
 tl:{lat:origin.lat+deltaLat(20),lng:origin.lng-deltaLng(25)},
 tr:{lat:origin.lat+deltaLat(20),lng:origin.lng+deltaLng(25)},
 bl:{lat:origin.lat-deltaLat(20),lng:origin.lng-deltaLng(25)},
 br:{lat:origin.lat-deltaLat(20),lng:origin.lng+deltaLng(25)}
};
const initial={...origin,accuracy:7};

test('local parado com variação GPS inferior à precisão não muda a posição exibida',()=>{
 const variation={lat:origin.lat+deltaLat(7),lng:origin.lng,accuracy:8};
 const fix=stableGps(initial,variation);
 assert.equal(fix.lat,initial.lat);
 assert.equal(fix.lng,initial.lng);
});
test('leitura substancialmente mais precisa substitui a anterior',()=>{
 const low={...origin,accuracy:45};
 const precise={lat:origin.lat+deltaLat(9),lng:origin.lng,accuracy:5};
 assert.equal(stableGps(low,precise).lat,precise.lat);
});
test('deslocamento real além do ruído atualiza gradualmente a posição',()=>{
 const moved=stableGps(initial,{lat:origin.lat+deltaLat(32),lng:origin.lng,accuracy:7});
 assert.ok(distanceMeters(initial,moved)>4);
 assert.ok(distanceMeters(initial,moved)<32);
});
test('leitura grosseira isolada não causa salto súbito',()=>{
 const bad={lat:origin.lat+deltaLat(40),lng:origin.lng,accuracy:30};
 assert.deepEqual(stableGps(initial,bad),initial);
});
test('conversão GPS centralizada aponta 50% × 50%',()=>{
 const p=gpsToMap(origin,bounds);
 assert.ok(p?.inside);
 assert.ok(Math.abs(p.x-50)<0.05);
 assert.ok(Math.abs(p.y-50)<0.05);
});
test('amigo fora do mapa tem posição visível na borda, não dentro',()=>{
 const outside={lat:origin.lat+deltaLat(40),lng:origin.lng};
 const projected=gpsToMap(outside,bounds);
 assert.equal(projected.inside,false);
 const edge=offMapInfo(projected,bounds);
 assert.ok(edge.outsideMeters>19&&edge.outsideMeters<21);
 assert.ok(edge.edgeX>=5&&edge.edgeX<=95);
 assert.ok(edge.edgeY>=5&&edge.edgeY<=95);
});
test('distância mínima usa borda do mapa, não distância ao canto',()=>{
 const north={x:50,y:-25,inside:false};
 const info=offMapInfo(north,bounds);
 assert.ok(info.outsideMeters>9.9&&info.outsideMeters<10.1);
});
test('tamanho aproximado do mapa corresponde à calibração de 50 × 40 metros',()=>{
 const scale=mapSize(bounds);
 assert.ok(Math.abs(scale.width-50)<.1);
 assert.ok(Math.abs(scale.height-40)<.1);
});
