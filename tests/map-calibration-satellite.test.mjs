import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const manual=read('artifacts/submundo-808/src/components/admin-manual-calibration.tsx');
const map=read('artifacts/submundo-808/src/components/admin-calibration-satellite-map.tsx');
const backend=read('server/index.mjs');
const security=read('server/request-security.mjs');
const geometry=read('artifacts/submundo-808/src/components/map-calibration-geometry.ts');

test('manual mode preserves coordinate inputs and offers a satellite tab with 4 selected corners',()=>{
 assert.match(manual,/Por coordenadas \(lat\/lng\)/);
 assert.match(manual,/Ajustar pelo mapa/);
 assert.match(manual,/method==='map'/);
 assert.match(manual,/onModeChange\('4'\)/);
 assert.match(map,/selecionado/);
 assert.match(manual,/Selecionar ponto/);
 assert.match(manual,/onMove=\{setMapCorner\}/);
 assert.match(manual,/onSelect=\{setSelectedCorner\}/);
 assert.match(manual,/onChange\(key,'lat',lat\.toFixed\(7\)\)/);
 assert.match(manual,/onChange\(key,'lng',lng\.toFixed\(7\)\)/);
 assert.match(manual,/buildManualCalibration\(values,mode\)/);
 assert.match(manual,/setReview\(true\)/);
 assert.match(manual,/onApply\(result\)/);
});
test('interactive map uses real Google Maps JS API, not a marker overlay on an iframe',()=>{
 assert.match(map,/fetch\('\/api\/admin\/map-config'/);
 assert.match(map,/maps\.googleapis\.com\/maps\/api\/js\?key=/);
 assert.match(map,/new maps\.Map\(elementRef\.current/);
 assert.match(map,/mapTypeId:'satellite'/);
 assert.match(map,/new maps\.Marker/);
 assert.match(map,/draggable:true/);
 assert.match(map,/marker\.addListener\('dragend'/);
 assert.match(map,/map\.addListener\('click'/);
 assert.match(map,/moveRef\.current\(k,pos\.lat,pos\.lng\)/);
 assert.match(map,/moveRef\.current\(selectedRef\.current,pos\.lat,pos\.lng\)/);
 assert.match(map,/new maps\.Polygon/);
 assert.match(map,/new maps\.Polyline/);
 assert.match(map,/setMapTypeId\(mapKind\)/);
 assert.match(map,/fillOpacity:\(opacity\/100\)\*\.48/);
 assert.match(map,/distanceMeters\(/);
 assert.match(map,/fitBounds\(bounds,55\)/);
 assert.match(map,/googleSatelliteEmbedUrl\(center,mapName\)/);
 assert.match(map,/somente consulta/);
});
test('calibration modal uses dark purple and neon green rather than image mockup blue',()=>{
 assert.match(manual,/bg-\[#17111e\]/);
 assert.match(manual,/bg-\[#c4ff40\]/);
 assert.match(manual,/accent-\[#c4ff40\]/);
 assert.match(manual,/grid-cols-2/);
 assert.match(manual,/Mostrar medidas \(m\)/);
 assert.match(manual,/Mostrar contorno da planta/);
 assert.match(manual,/Opacidade da planta/);
 assert.match(manual,/Aplicar calibração/);
});
test('browser API key is only available to authenticated admins and CSP allows Google Maps',()=>{
 assert.match(backend,/url\.pathname==='\/api\/admin\/map-config'&&req\.method==='GET'/);
 assert.match(backend,/if\(!isAdmin\(user\)\)return json\(res,403/);
 assert.match(backend,/googleMapsBrowserKey:process\.env\.GOOGLE_MAPS_BROWSER_API_KEY\|\|''/);
 assert.match(security,/script-src 'self' https:\/\/maps\.googleapis\.com https:\/\/maps\.gstatic\.com/);
 assert.match(security,/connect-src 'self' .*https:\/\/maps\.googleapis\.com/);
});
test('calibration still validates geometry and expands measured corners by 5 metres',()=>{
 assert.match(geometry,/export const MAP_MARGIN_METERS=5/);
 assert.match(manual,/buildManualCalibration\(values,mode\)/);
 assert.match(manual,/onApply\(result\)/);
});
