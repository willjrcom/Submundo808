import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const editor=read('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const manual=read('artifacts/submundo-808/src/components/admin-manual-calibration.tsx');
const geometry=read('artifacts/submundo-808/src/components/map-calibration-geometry.ts');
const csp=read('server/request-security.mjs');

test('Calibrar mapa opens a choice, preserving original GPS workflow',()=>{
 assert.match(editor,/function chooseCalibrationMode\(\)/);
 assert.match(editor,/onClick=\{openCalibrationOverview\}/);
 assert.match(editor,/aria-label="Escolher modo de calibração"/);
 assert.match(editor,/Calibrar usando GPS/);
 assert.match(editor,/Inserir coordenadas manualmente/);
 assert.match(editor,/startGpsCalibration/);
 assert.match(editor,/setCalibrationOpen\(true\)/);
 assert.match(editor,/Calibração por GPS/);
 assert.match(editor,/GPS_CAPTURE_MS/);
 assert.match(editor,/confirmCapturedPoint/);
 assert.match(editor,/Voltar aos métodos/);
});
test('calibrated maps show a read-only perspective overview and recalibration option',()=>{
 const overview=read('artifacts/submundo-808/src/components/admin-calibration-overview.tsx');
 assert.match(editor,/const calibrationComplete=geometryValid&&corners\?\.mode!=='demo-auto'/);
 assert.match(editor,/calibrationComplete\?'Ver calibração':'Calibrar mapa'/);
 assert.match(editor,/<AdminCalibrationOverview/);
 assert.match(editor,/onRecalibrate=\{recalibrateMap\}/);
 assert.match(editor,/setCalibrationOverviewOpen\(false\)/);
 assert.match(editor,/setManualStarted\(false\)/);
 assert.match(overview,/aria-label="Ver calibração do mapa"/);
 assert.match(overview,/Planta na orientação geográfica real/);
 assert.match(overview,/calibrationPreviewProjection\(frame/);
 assert.match(overview,/projectEditorAreaPath\(areaPath\(areas,area\.id\)/);
 assert.match(overview,/projection\.projectGps\(raw\[key\]\)/);
 assert.match(overview,/Norte para cima/);
 assert.match(overview,/seta verde aponta para o topo/);
 assert.doesNotMatch(overview,/matrix\(2\.7 0\.85 -1 1\.5/);
 assert.doesNotMatch(overview,/const markers=\[/);
 assert.match(overview,/areaPath\(areas,area\.id\)/);
 assert.match(overview,/measuredCorners\(gps\)/);
 assert.match(overview,/googleMapsLink\(position,mapName\)/);
 assert.match(overview,/Margem externa registrada: 5 metros/);
 assert.match(overview,/Recalibrar/);
 assert.match(overview,/hasUnsavedChanges/);
});
test('manual calibration uses four numbered border selectors and a top-of-plan arrow',()=>{
 const orientation=read('artifacts/submundo-808/src/components/map-calibration-orientation.tsx');
 assert.match(manual,/<MapCalibrationOrientation/);
 assert.match(manual,/selectedCorner/);
 assert.match(manual,/selectCorner=\(key:CornerKey\)/);
 assert.match(orientation,/TOPO DO DESENHO/);
 assert.match(orientation,/não o norte geográfico/);
 assert.match(orientation,/cada número representa um/);
 assert.match(orientation,/onSelect\(key\)/);
 for(const position of ['left-[27%] top-[15%]','left-[85%] top-[30%]','left-[73%] top-[85%]','left-[15%] top-[70%]']){
  assert.ok(orientation.includes(position),position);
 }
 assert.match(manual,/value=\{estimated&&result\.ok\?result\.raw\.br\.lat/);
});
test('manual modal offers four-corner or marked 3-point estimation and a real satellite iframe',()=>{
 assert.match(editor,/<AdminManualCalibration mapName=\{mapName\}/);
 assert.match(manual,/aria-label="Calibração manual de mapa"/);
 assert.match(manual,/4 cantos · recomendado/);
 assert.match(manual,/3 pontos/);
 assert.match(manual,/O quarto canto será estimado|canto inferior direito será estimado/);
 assert.match(manual,/Latitude/);
 assert.match(manual,/Longitude/);
 assert.match(manual,/Imagem de satélite · Google Maps/);
 assert.match(manual,/<iframe title="Imagem de satélite do Google Maps"/);
 assert.match(manual,/googleSatelliteEmbedUrl\(position,mapName\)/);
 assert.match(manual,/googleMapsLink\(position,mapName\)/);
 assert.match(csp,/frame-src[^\n]*https:\/\/maps\.google\.com/);
});
test('manual calibration requires preview and confirmation, replacing GPS points only in local editor',()=>{
 assert.match(manual,/buildManualCalibration\(values,mode\)/);
 assert.match(manual,/setReview\(true\)/);
 assert.match(manual,/role="alert"/);
 assert.match(manual,/Revisar calibração/);
 assert.match(manual,/Confirmar calibração/);
 assert.match(manual,/Aplicar ao rascunho da planta/);
 assert.match(editor,/function confirmManualCalibration\(result:/);
 assert.match(editor,/checkpoint\(\)/);
 assert.match(editor,/setAreas\(old=>old\.map\(a=>\(\{\.\.\.a,gps:a\.id===calibrationArea\.id\?result\.gps:\{\}\}\)\)\)/);
 assert.match(editor,/Calibração manual aplicada ao rascunho/);
 assert.match(editor,/Calibração preparada!/);
 assert.match(editor,/Salvar mapa/);
 assert.match(geometry,/MAP_MARGIN_METERS=5/);
});
test('manual modal is navigable and keeps inputs after switching methods',()=>{
 assert.match(editor,/const \[manualStarted,setManualStarted\]=useState\(false\)/);
 assert.match(editor,/if\(!manualStarted\)\{setManualValues\(manualValuesFromGps\(corners\)\)/);
 assert.match(editor,/onChange=\{\(key,field,value\)=>setManualValues/);
 assert.match(editor,/onBack=\{\(\)=>\{setManualCalibrationOpen\(false\);setCalibrationChoiceOpen\(true\)/);
 assert.match(editor,/event\.key==='Escape'&&manualCalibrationOpen/);
 assert.match(manual,/aria-label="Fechar calibração manual"/);
 assert.match(manual,/Escolher outro método/);
});
