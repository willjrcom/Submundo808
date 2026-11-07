import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code=readFileSync(new URL('../artifacts/submundo-808/src/components/map-calibration-preview-projection.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {calibrationPreviewProjection,projectEditorAreaPath,coordinateString}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

// These are the measured four corners from the Uzna calibration screenshot,
// not a hard-coded perspective that could accidentally flip the room layout.
const uzna={
 tl:{lat:-23.451854,lng:-47.398631},
 tr:{lat:-23.451190,lng:-47.398921},
 br:{lat:-23.450266,lng:-47.397799},
 bl:{lat:-23.450876,lng:-47.397462}
};
const distance=(a,b)=>Math.hypot((b.lng-a.lng)*111320*Math.cos(a.lat*Math.PI/180),(b.lat-a.lat)*111320);
const screenDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('norte geográfico fica para cima, leste para direita, sem espelhar a ordem dos quatro cantos reais',()=>{
 const p=calibrationPreviewProjection(uzna);
 assert.ok(p.corners.tl.y>p.corners.tr.y,'ponto 1 está ao sul do 2');
 assert.ok(p.corners.br.y<p.corners.bl.y,'ponto 3 está ao norte do 4');
 assert.ok(p.corners.tr.x<p.corners.bl.x,'ponto 2 está a oeste do 4');
 assert.ok(p.corners.tl.x<p.corners.br.x,'ponto 1 está a oeste do 3');
 assert.ok(p.corners.br.x>p.corners.tr.x,'ponto 3 está a leste do 2');
 const center=p.pointAt(50,50);
 const expectedX=Object.values(p.corners).reduce((n,v)=>n+v.x,0)/4;
 const expectedY=Object.values(p.corners).reduce((n,v)=>n+v.y,0)/4;
 assert.ok(Math.abs(center.x-expectedX)<1e-7);
 assert.ok(Math.abs(center.y-expectedY)<1e-7);
 const top=p.pointAt(50,0),base=p.pointAt(50,100);
 assert.ok(Math.abs(top.x-(p.corners.tl.x+p.corners.tr.x)/2)<1e-7);
 assert.ok(Math.abs(top.y-(p.corners.tl.y+p.corners.tr.y)/2)<1e-7);
 assert.ok(Math.abs(base.y-(p.corners.bl.y+p.corners.br.y)/2)<1e-7);
});
test('escala real não força quadrilátero a ter lados fictícios',()=>{
 const p=calibrationPreviewProjection(uzna);
 const physicalRatio=distance(uzna.tl,uzna.tr)/distance(uzna.tl,uzna.bl);
 const visualRatio=screenDistance(p.corners.tl,p.corners.tr)/screenDistance(p.corners.tl,p.corners.bl);
 assert.ok(Math.abs(visualRatio-physicalRatio)<0.0005);
 const point={lat:(uzna.tl.lat+uzna.br.lat)/2,lng:(uzna.tl.lng+uzna.br.lng)/2};
 const projected=p.projectGps(point);
 assert.ok(Number.isFinite(projected.x)&&Number.isFinite(projected.y));
 assert.ok(p.corners.tl.x>=0&&p.corners.tl.y>=0);
});
test('o mesmo plano cartesiano do editor projeta as salas nos cantos geográficos salvos',()=>{
 const p=calibrationPreviewProjection(uzna);
 const rectangle='M0 0 L100 0 L100 100 L0 100 Z';
 const d=projectEditorAreaPath(rectangle,p.pointAt);
 assert.equal(d,'M'+coordinateString(p.corners.tl)
  +'L'+coordinateString(p.corners.tr)
  +'L'+coordinateString(p.corners.br)
  +'L'+coordinateString(p.corners.bl)+'Z');
});
test('a curvatura e a silhueta agrupada continuam georreferenciadas',()=>{
 const p=calibrationPreviewProjection(uzna);
 const curved=projectEditorAreaPath('M0 0 Q50 -20 100 0 L100 100 L0 100 Z',p.pointAt);
 assert.ok(curved.startsWith('M'));
 assert.ok((curved.match(/L/g)||[]).length>=16);
 assert.ok(curved.endsWith('Z'));
 const cubic=projectEditorAreaPath('M0 0 C0 -50 100 -50 100 0 L100 100 Z',p.pointAt);
 assert.ok((cubic.match(/L/g)||[]).length>=21);
 const group=projectEditorAreaPath('M0 0 L40 0 L40 40 L80 40 L80 80 L0 80 Z',p.pointAt);
 assert.ok(group.includes('L')&&group.endsWith('Z'));
});
test('a sala oval continua oval, sem desenhar um arco inválido',()=>{
 const p=calibrationPreviewProjection(uzna);
 const ellipse=projectEditorAreaPath('M75 50 A25 20 0 1 0 25 50 A25 20 0 1 0 75 50 Z',p.pointAt,
  {x:25,y:30,width:50,height:40});
 assert.ok(ellipse.startsWith('M')&&ellipse.endsWith('Z'));
 assert.ok((ellipse.match(/L/g)||[]).length>=70);
 assert.doesNotMatch(ellipse,/\bA\b/);
});
