// A URL é a fonte de verdade para a navegação administrativa.
// Mantém seções, formulários e editores abertos após recarregar a página.
export type AdminSection='Visão geral'|'Inteligência'|'Estabelecimentos'|'Mapas e ambientes'|'Eventos'|'Produtos'|'Avaliações'|'Notificações'|'Preferências';
export type AdminRoute={section:AdminSection;id:string|null;creating:boolean;mapId?:string;analytics?:boolean};
const roots:Record<AdminSection,string>={
 'Visão geral':'/',
 'Inteligência':'/intelligence',
 'Estabelecimentos':'/venues',
 'Mapas e ambientes':'/maps',
 'Eventos':'/events',
 'Produtos':'/products',
 'Avaliações':'/reviews',
 'Notificações':'/notifications',
 'Preferências':'/preferences'
};
const sectionBySegment:Record<string,AdminSection>={
 inteligencia:'Inteligência',intelligence:'Inteligência',
 estabelecimentos:'Estabelecimentos',venues:'Estabelecimentos',
 mapas:'Mapas e ambientes',maps:'Mapas e ambientes',
 eventos:'Eventos',events:'Eventos',
 produtos:'Produtos',products:'Produtos',avaliacoes:'Avaliações',reviews:'Avaliações',notificacoes:'Notificações',notifications:'Notificações',preferences:'Preferências'
};
export function parseAdminRoute(pathname:string):AdminRoute{
 const segments=pathname.split('/').filter(Boolean);
 const section=sectionBySegment[segments[0]]||'Visão geral';
 if(section==='Visão geral'||section==='Inteligência'||section==='Produtos'||section==='Avaliações'||section==='Notificações'||section==='Preferências')return {section,id:null,creating:false};
 if(section==='Estabelecimentos'&&segments.length===3&&segments[2]==='analytics'){
  try{const id=decodeURIComponent(segments[1]);if(id&&!['new','novo'].includes(id))return {section,id,creating:false,analytics:true};}catch{}
  return {section,id:null,creating:false};
 }
 if(section==='Estabelecimentos'&&segments.length===4&&['mapas','maps'].includes(segments[2])){
  try{
   const id=decodeURIComponent(segments[1]),mapId=decodeURIComponent(segments[3]);
   if(id&&mapId&&!['novo','new'].includes(id)&&!['novo','new'].includes(mapId))return {section,id,creating:false,mapId};
  }catch{}
  return {section,id:null,creating:false};
 }
 const detail=segments.length===2?segments[1]:null;
 if(detail==='novo'||detail==='new')return {section,id:null,creating:true};
 if(detail){
  try{return {section,id:decodeURIComponent(detail),creating:false};}
  catch{return {section,id:null,creating:false};}
 }
 return {section,id:null,creating:false};
}
export function adminRoutePath(route:AdminRoute):string{
 const base=roots[route.section];
 if(route.section==='Visão geral'||route.section==='Inteligência'||route.section==='Produtos'||route.section==='Preferências')return base;
 if(route.section==='Estabelecimentos'&&route.id&&route.analytics)return base+'/'+encodeURIComponent(route.id)+'/analytics';
 if(route.section==='Estabelecimentos'&&route.id&&route.mapId)
  return base+'/'+encodeURIComponent(route.id)+'/maps/'+encodeURIComponent(route.mapId);
 if(route.creating)return base+'/new';
 if(route.id)return base+'/'+encodeURIComponent(route.id);
 return base;
}
