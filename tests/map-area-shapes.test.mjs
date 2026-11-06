import test from 'node:test';
import assert from 'node:assert/strict';
import {areaPath,visibleAreas,canGroup,groupWith,ungroup,isGrouped,moveAreaGroup} from '../artifacts/submundo-808/src/components/map-area-shapes.ts';
import {validateAreaGeometries,parseAreaGeometry} from '../server/map-area-geometry.mjs';

const room=(id,x,y,width=20,height=20)=>({id,x,y,width,height,geometry:{shape:'rect'}});
const base=[room('principal',10,10,20,20),room('puxadinho',30,10,10,10),room('outro',60,60,20,20)];

test('puxadinho adjacente agrupa no ambiente principal sem perder peças originais',()=>{
 assert.equal(canGroup(base,'principal','puxadinho'),true);
 assert.equal(canGroup(base,'principal','outro'),false);
 const combined=groupWith(base,'principal','puxadinho');
 assert.equal(combined.length,3);
 assert.equal(combined[1].geometry.groupId,'principal');
 assert.deepEqual(visibleAreas(combined).map(a=>a.id),['principal','outro']);
 assert.ok(isGrouped(combined,'principal'));
 const path=areaPath(combined,'principal');
 assert.ok(path.startsWith('M'));
 assert.ok(path.endsWith('Z'));
 assert.equal((path.match(/\bM/g)||[]).length,1,'região conectada usa uma silhueta');
 assert.equal(validateAreaGeometries(combined),null);
 const separated=ungroup(combined,'principal');
 assert.equal(separated[1].geometry.groupId,null);
 assert.equal(isGrouped(separated,'principal'),false);
 assert.equal(separated[0].name,base[0].name);
});
test('mover ambiente agrupado movimenta todas as peças e preserva seus tamanhos e distância',()=>{
 const grouped=groupWith(base,'principal','puxadinho');
 const moved=moveAreaGroup(grouped,'principal',15,16,false);
 assert.equal(moved[0].x,15);
 assert.equal(moved[0].y,16);
 assert.equal(moved[1].x,35);
 assert.equal(moved[1].y,16);
 assert.equal(moved[1].width,10);
 assert.equal(moved[2].x,60);
});
test('ambiente redondo vira elipse e impede agrupamento de contornos incompatíveis',()=>{
 const circle={...base[0],geometry:{shape:'ellipse'}};
 const path=areaPath([circle],'principal');
 assert.match(path,/\bA10 10 0 1 0/);
 assert.equal(canGroup([circle,base[1]],'principal','puxadinho'),false);
 assert.equal(validateAreaGeometries([circle]),null);
});
test('curvatura externa ou interna gera arco quadrático sem alterar dimensões do retângulo',()=>{
 const room1={...base[0],geometry:{shape:'rect',curve:{side:'top',direction:'in',depth:30}}};
 const inward=areaPath([room1],'principal');
 const outward=areaPath([{...room1,geometry:{...room1.geometry,curve:{...room1.geometry.curve,direction:'out'}}}],'principal');
 assert.match(inward,/Q/);
 assert.match(outward,/Q/);
 assert.notEqual(inward,outward);
 assert.equal(room1.width,20);
});
test('servidor rejeita grupos órfãos, ciclos, geometria inválida e peças desconectadas',()=>{
 assert.match(validateAreaGeometries([{...base[0],geometry:{groupId:'missing'}}]),/Agrupamento/);
 const detached=base.map((a,i)=>i===2?{...a,geometry:{groupId:'principal'}}:a);
 assert.match(validateAreaGeometries(detached),/bordas conectadas/);
 assert.match(validateAreaGeometries([{...base[0],geometry:{curve:{side:'top',direction:'out',depth:80}}}]),/Curvatura/);
 assert.match(validateAreaGeometries([{...base[0],geometry:{shape:'ellipse',groupId:'puxadinho'}},base[1]]),/Agrupamento/);
 assert.equal(validateAreaGeometries(base),null);
});
test('geometrias antigas sem metadata são retangulares e legíveis',()=>{
 assert.deepEqual(parseAreaGeometry(undefined),{});
 assert.deepEqual(parseAreaGeometry('{}'),{});
 assert.deepEqual(parseAreaGeometry('{invalid'),{});
 assert.match(areaPath([{id:'legacy',x:0,y:0,width:20,height:10}],'legacy'),/^M/);
});
