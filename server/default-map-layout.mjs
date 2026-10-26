// Initial map template; saved/customized maps are never regenerated.
export const DEFAULT_MAP_AREAS=[
 {name:'Área VIP',kind:'vip',x:0,y:0,width:100,height:48,color:'#9747FF',icon:'vip'},
 {name:'Pista',kind:'pista',x:0,y:48,width:100,height:52,color:'#3B82F6',icon:'pista'}
];
export function insertDefaultMapAreas(db,mapId,makeId){
 const stmt=db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height,color,icon) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(const a of DEFAULT_MAP_AREAS)stmt.run(makeId(),mapId,a.name,a.kind,a.x,a.y,a.width,a.height,a.color,a.icon);
}
