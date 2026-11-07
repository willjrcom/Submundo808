import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManualCalibration,emptyManualValues,manualValuesFromGps,parseManualCoordinate,mapPreviewPosition,googleSatelliteEmbedUrl,googleMapsLink} from '../artifacts/submundo-808/src/components/map-calibration-manual.ts';
import {cornersGeometryValid,measuredCorners,MAP_MARGIN_METERS} from '../artifacts/submundo-808/src/components/map-calibration-geometry.ts';
const four={
 tl:{lat:'-23.450000',lng:'-47.400000'},
 tr:{lat:'-23.450000',lng:'-47.399000'},
 bl:{lat:'-23.451000',lng:'-47.400000'},
 br:{lat:'-23.451000',lng:'-47.399000'}
};

test('manual 4-point calibration records real coordinates, expands 5 m, and stays an unpublished draft',()=>{
 const result=buildManualCalibration(four,'4');
 assert.equal(result.ok,true);
 assert.equal(result.derived,false);
 assert.equal(result.gps.origin,'coordinates');
 assert.equal(result.gps.mode,'manual');
 assert.equal(result.gps.marginMeters,MAP_MARGIN_METERS);
 assert.equal(result.raw.tl.lat,-23.45);
 assert.ok(Math.abs(result.gps.tl.lat-result.raw.tl.lat)>0);
 assert.equal(cornersGeometryValid(result.raw),true);
 assert.ok(result.width>70&&result.height>100);
});
test('3-point option estimates a clearly marked fourth point',()=>{
 const result=buildManualCalibration({...four,br:{lat:'',lng:''}},'3');
 assert.equal(result.ok,true);
 assert.equal(result.derived,true);
 assert.ok(Math.abs(result.raw.br.lat+23.451)<1e-7);
 assert.ok(Math.abs(result.raw.br.lng+47.399)<1e-7);
 assert.equal(cornersGeometryValid(result.raw),true);
});
test('invalid, crossed and incomplete corner values never overwrite calibration',()=>{
 const missing=buildManualCalibration({...four,tl:{lat:'',lng:four.tl.lng}},'4');
 assert.equal(missing.ok,false);
 const invalid=buildManualCalibration({...four,br:{lat:'-91',lng:'150'}},'4');
 assert.equal(invalid.ok,false);
 const flipped=buildManualCalibration({...four,br:four.bl,bl:four.br},'4');
 assert.equal(flipped.ok,false);
 assert.equal(parseManualCoordinate(' -23,451704 ',90),-23.451704);
 assert.equal(parseManualCoordinate('23.4 5',90),null);
 assert.equal(parseManualCoordinate('Infinity',90),null);
 assert.equal(parseManualCoordinate('181',180),null);
});
test('editing GPS coordinates recalculates measured distances and margin without changing saved values',()=>{
 const saved=buildManualCalibration(four,'4');
 assert.equal(saved.ok,true);
 const fields=manualValuesFromGps(saved.gps);
 const edited={...fields,tl:{...fields.tl,lng:'-47.400100'}};
 const result=buildManualCalibration(edited,'4');
 assert.equal(result.ok,true);
 assert.equal(result.gps.rawCorners.tl.lng,-47.4001);
 assert.equal(result.gps.marginMeters,MAP_MARGIN_METERS);
 assert.ok(Math.abs(result.gps.tl.lng-result.raw.tl.lng)>0);
 assert.notEqual(result.width,saved.width);
 assert.equal(saved.raw.tl.lng,-47.4);
 const invalid=buildManualCalibration({...fields,tl:fields.br},'4');
 assert.equal(invalid.ok,false);
});
test('existing manual calibration hydrates four input rows without using expanded margins',()=>{
 const result=buildManualCalibration(four,'4');
 const filled=manualValuesFromGps(result.gps);
 assert.equal(filled.tl.lat,four.tl.lat.replace(/0+$/,'').replace(/\.$/,''));
 assert.equal(filled.tr.lng,'-47.399');
 assert.deepEqual(manualValuesFromGps(undefined),emptyManualValues());
 assert.equal(measuredCorners(result.gps).br.lng,-47.399);
});
test('satellite map embeds current user points or existing calibration, never a fixed city',()=>{
 const center=mapPreviewPosition(four,undefined);
 assert.ok(center.lat < -23.45 && center.lat > -23.451);
 assert.ok(googleSatelliteEmbedUrl(center,'Uzna').startsWith('https://maps.google.com/maps?q='));
 assert.match(googleSatelliteEmbedUrl(center,'Uzna'),/&t=k&z=19&output=embed$/);
 assert.match(googleMapsLink(center,'Uzna'),/^https:\/\/www\.google\.com\/maps\/search/);
 assert.equal(mapPreviewPosition(emptyManualValues(),buildManualCalibration(four,'4').gps).lat,-23.45);
 assert.match(googleSatelliteEmbedUrl(null,'Planta A'),/Planta%20A/);
});
