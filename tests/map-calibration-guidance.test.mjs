import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read=(path)=>readFileSync(new URL('../artifacts/submundo-808/src/components/'+path,import.meta.url),'utf8');
const tsCompile=(code)=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const utilsUrl='data:text/javascript;base64,'+Buffer.from(tsCompile(read('map-location-utils.ts'))).toString('base64');
const geometrySource=read('map-calibration-geometry.ts');
const geometryUrl='data:text/javascript;base64,'+Buffer.from(tsCompile(geometrySource.replace("from './map-location-utils'",'from '+JSON.stringify(utilsUrl)))).toString('base64');
const {gpsToMap,distanceMeters}=await import(utilsUrl);
const {MAP_MARGIN_METERS,GPS_CAPTURE_MS,expandMeasuredCorners,measuredCorners,applyMeasuredCorner,
 summarizeGpsSamples,cornersGeometryValid,mapPercentToGps}=await import(geometryUrl);

function original(){
 return {
  tl:{lat:-23,lng:-47,accuracy:4},tr:{lat:-23,lng:-46.9995,accuracy:5},
  bl:{lat:-23.0005,lng:-47,accuracy:4},br:{lat:-23.0005,lng:-46.9995,accuracy:5}
 };
}
test('calibração desloca cada canto 5 metros para FORA nas duas direções',()=>{
 const raw=original();
 const adjusted=expandMeasuredCorners(raw);
 assert.ok(adjusted);
 const near=(x)=>assert.ok(Math.abs(x-5)<0.15,'offset esperado de cinco metros: '+x);
 near(distanceMeters(raw.tl,{...adjusted.tl,lat:raw.tl.lat})); // horizontal
 near(distanceMeters(raw.tl,{...adjusted.tl,lng:raw.tl.lng})); // vertical
 assert.ok(adjusted.tl.lat>raw.tl.lat&&adjusted.tl.lng<raw.tl.lng);
 assert.ok(adjusted.tr.lat>raw.tr.lat&&adjusted.tr.lng>raw.tr.lng);
 assert.ok(adjusted.bl.lat<raw.bl.lat&&adjusted.bl.lng<raw.bl.lng);
 assert.ok(adjusted.br.lat<raw.br.lat&&adjusted.br.lng>raw.br.lng);
 assert.equal(MAP_MARGIN_METERS,5);
 assert.equal(GPS_CAPTURE_MS,8000);
});
test('margem acompanha mapa rotacionado e preserva o centro geográfico',()=>{
 const tl={lat:-23,lng:-47,accuracy:3};
 const tr={lat:-22.9997,lng:-46.9997,accuracy:3};
 const bl={lat:-23.0004,lng:-46.9996,accuracy:3};
 const br={lat:tr.lat+bl.lat-tl.lat,lng:tr.lng+bl.lng-tl.lng,accuracy:3};
 const raw={tl,tr,bl,br};
 assert.equal(cornersGeometryValid(raw),true);
 const expanded=expandMeasuredCorners(raw,5);
 assert.ok(expanded);
 for(const key of ['tl','tr','bl','br'])assert.ok(distanceMeters(raw[key],expanded[key])>6.9);
 const rawCenter=mapPercentToGps(50,50,raw);
 const expandedCenter=mapPercentToGps(50,50,expanded);
 assert.ok(distanceMeters(rawCenter,expandedCenter)<0.15);
 const p=gpsToMap(rawCenter,expanded);
 assert.ok(p?.inside);
 assert.ok(Math.abs(p.x-50)<.01&&Math.abs(p.y-50)<.01);
});
test('geometria cruzada não deve aplicar margem ou salvar quadrilátero invertido',()=>{
 const raw=original();
 const crossed={...raw,tr:raw.bl,bl:raw.tr};
 assert.equal(cornersGeometryValid(crossed),false);
 assert.equal(expandMeasuredCorners(crossed),null);
 assert.equal(expandMeasuredCorners({...raw,br:raw.tl}),null);
});
test('guarda medições brutas e evita duplicar margem em recalibrações',()=>{
 const raw=original();
 let state;
 for(const key of ['tl','tr','bl','br'])state=applyMeasuredCorner(state,key,raw[key]);
 assert.equal(state.marginMeters,5);
 assert.ok(state.rawCorners);
 for(const key of ['tl','tr','bl','br'])assert.deepEqual(measuredCorners(state)[key],raw[key]);
 const first=state.tl;
 state=applyMeasuredCorner(state,'br',{...raw.br,lat:raw.br.lat-.00001});
 assert.equal(state.marginMeters,5);
 assert.deepEqual(state.rawCorners.tl,raw.tl);
 assert.ok(distanceMeters(first,state.tl)<2);
 const legacy={...raw,mode:'manual'};
 const upgraded=applyMeasuredCorner(legacy,'tl',raw.tl);
 assert.equal(upgraded.marginMeters,5);
 assert.deepEqual(upgraded.rawCorners,raw);
});
test('rejeita saltos de GPS e calcula mediana de amostras boas',()=>{
 const base={lat:-23.1,lng:-47.2,accuracy:6};
 const readings=[
  base,{...base,lat:base.lat+.000001,accuracy:5},
  {...base,lat:base.lat-.000001,accuracy:8},
  {...base,lat:base.lat+.00095,accuracy:8},
  {...base,accuracy:250}];
 const result=summarizeGpsSamples(readings);
 assert.ok(result);
 assert.equal(result.accepted,3);
 assert.equal(result.total,5);
 assert.ok(distanceMeters(result.point,base)<1);
 assert.equal(result.reliable,true);
 assert.equal(summarizeGpsSamples([{...base,accuracy:80}]),null);
});
test('interface tem os botões nos cantos, progresso automático e confirmação individual',()=>{
 const admin=read('admin-map-workspace.tsx');
 const participant=read('venue-map.tsx');
 assert.match(admin,/top-2 left-2/);
 assert.match(admin,/top-2 right-2/);
 assert.match(admin,/bottom-2 left-2/);
 assert.match(admin,/bottom-2 right-2/);
 assert.match(admin,/navigator\.geolocation\.watchPosition/);
 assert.match(admin,/captureProgressTimer/);
 assert.match(admin,/Progresso da captura GPS/);
 assert.match(admin,/segundos restantes/);
 assert.match(admin,/Mapear novamente/);
 assert.match(admin,/Confirmar ponto/);
 assert.match(admin,/applyMeasuredCorner/);
 assert.match(admin,/rawCorners/);
 assert.match(participant,/Como chegar à entrada/);
 assert.match(participant,/Entrada não cadastrada/);
 assert.match(participant,/positionUncertain/);
 assert.match(participant,/directionsUrl/);
 assert.match(participant,/mapIsDemo/);
});
