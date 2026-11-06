// Contrato do formato dos ambientes, independente de SQLite/PostgreSQL.
const SIDES=new Set(['top','right','bottom','left']);
const SHAPES=new Set(['rect','ellipse']);
const DIRECTIONS=new Set(['in','out']);
export function parseAreaGeometry(raw){
 if(!raw)return {};
 try{
  const g=typeof raw==='string'?JSON.parse(raw):raw;
  return g&&typeof g==='object'&&!Array.isArray(g)?g:{};
 }catch{return {};}
}
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const proximity=(a,b)=>{
 const x=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
 const y=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
 const eps=.06;
 return x>eps&&y>eps||Math.abs(x)<eps&&y>eps||Math.abs(y)<eps&&x>eps;
};
export function validateAreaGeometries(areas){
 const byId=new Map(areas.map(a=>[a.id,a]));
 for(const a of areas){
  const g=a.geometry;
  if(g===undefined||g===null)continue;
  if(!plain(g))return 'Formato do ambiente inválido.';
  if(g.shape!==undefined&&!SHAPES.has(g.shape))return 'Formato do ambiente inválido.';
  if(g.curve!==undefined&&g.curve!==null){
   if(!plain(g.curve)||!SIDES.has(g.curve.side)||!DIRECTIONS.has(g.curve.direction)||
      typeof g.curve.depth!=='number'||!Number.isFinite(g.curve.depth)||g.curve.depth<1||g.curve.depth>40||
      g.shape==='ellipse')return 'Curvatura inválida.';
  }
  if(g.groupId!==undefined&&g.groupId!==null){
   if(typeof g.groupId!=='string'||g.groupId.length>100||g.groupId===a.id||
      !byId.has(g.groupId)||byId.get(g.groupId)?.geometry?.groupId||
      g.shape==='ellipse'||byId.get(g.groupId)?.geometry?.shape==='ellipse')
    return 'Agrupamento inválido: escolha um ambiente principal existente.';
  }
  if(JSON.stringify(g).length>500)return 'Formato do ambiente excede o limite.';
 }
 // Agrupamentos precisam formar uma única região conectada (lado comum ou interseção).
 for(const root of areas.filter(a=>!a.geometry?.groupId)){
  const members=areas.filter(a=>a.id===root.id||a.geometry?.groupId===root.id);
  if(members.length===1)continue;
  const visited=new Set([root.id]);let changed=true;
  while(changed){
   changed=false;
   for(const a of members){
    if(visited.has(a.id))continue;
    if(members.some(b=>visited.has(b.id)&&proximity(a,b))){visited.add(a.id);changed=true;}
   }
  }
  if(visited.size!==members.length)return 'Ambientes agrupados devem manter bordas conectadas.';
 }
 return null;
}
