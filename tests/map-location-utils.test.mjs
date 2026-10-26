import test from 'node:test';
import assert from 'node:assert/strict';
import {stableGps,distanceMeters,gpsToMap,offMapInfo,mapSize,formatMapDistance} from '../artifacts/submundo-808/src/components/map-location-utils.ts';

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

test('seta aponta para a direção real do GPS fora dos quatro limites',()=>{
 const cases=[
  [{x:50,y:-20,inside:false},'acima',0],
  [{x:50,y:120,inside:false},'abaixo',180],
  [{x:-20,y:50,inside:false},'à esquerda',270],
  [{x:120,y:50,inside:false},'à direita',90]
 ];
 for(const [point,direction,angle] of cases){
  const info=offMapInfo(point,bounds);
  assert.equal(info.direction,direction);
  assert.ok(Math.abs(info.angleDegrees-angle)<0.001);
  assert.ok(info.outsideMeters>0);
  assert.ok(info.edgeX>=7&&info.edgeX<=93);
  assert.ok(info.edgeY>=7&&info.edgeY<=93);
 }
});
test('seta representa corretamente as quatro direções diagonais',()=>{
 const cases=[
  [{x:120,y:-25,inside:false},'acima e à direita',0,90],
  [{x:120,y:125,inside:false},'abaixo e à direita',90,180],
  [{x:-20,y:125,inside:false},'abaixo e à esquerda',180,270],
  [{x:-20,y:-25,inside:false},'acima e à esquerda',270,360]
 ];
 for(const [point,direction,angleFrom,angleTo] of cases){
  const info=offMapInfo(point,bounds);
  assert.equal(info.direction,direction);
  assert.ok(info.angleDegrees>angleFrom&&info.angleDegrees<angleTo);
 }
});
test('seta permanece na borda mesmo com GPS muito distante',()=>{
 const info=offMapInfo({x:2500,y:-3200,inside:false},bounds);
 assert.equal(info.edgeX,93);
 assert.equal(info.edgeY,7);
 assert.equal(info.direction,'acima e à direita');
 assert.ok(info.outsideMeters>1000);
});
test('distância exibida usa metros e quilômetros com formatação brasileira',()=>{
 assert.equal(formatMapDistance(19.5),'20 m');
 assert.equal(formatMapDistance(1000),'1 km');
 assert.equal(formatMapDistance(1550),'1,6 km');
 assert.equal(formatMapDistance(-1),'distância indisponível');
});
test('distâncias diagonais consideram largura e altura reais do mapa',()=>{
 const info=offMapInfo({x:120,y:-25,inside:false},bounds);
 assert.ok(Math.abs(info.outsideMeters-Math.hypot(10,10))<0.1);
 assert.ok(Math.abs(info.angleDegrees-45)<0.2);
});
