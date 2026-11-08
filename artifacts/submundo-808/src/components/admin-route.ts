// A URL é a fonte de verdade para a navegação administrativa.
// Mantém seções, formulários e editores abertos após recarregar a página.
export type AdminSection='Visão geral'|'Estatísticas'|'Estabelecimentos'|'Mapas e ambientes'|'Eventos'|'Produtos'|'Avaliações'|'Notificações'|'Administradores'|'Preferências';
export type AdminRoute={section:AdminSection;id:string|null;creating:boolean;mapId?:string;analytics?:boolean;eventId?:string;menu?:boolean};
const roots:Record<AdminSection,string>={
 'Visão geral':'/',
 'Estatísticas':'/statistics',
 'Estabelecimentos':'/venues',
 'Mapas e ambientes':'/maps',
 'Eventos':'/events',
 'Produtos':'/products',
 'Avaliações':'/reviews',
 'Notificações':'/notifications',
 'Administradores':'/admins',
 'Preferências':'/preferences'
};
const sectionBySegment:Record<string,AdminSection>={
 // URLs antigas seguem válidas, mas o nome da interface é Estatísticas.
 inteligencia:'Estatísticas',intelligence:'Estatísticas',
 estatisticas:'Estatísticas',statistics:'Estatísticas',
 estabelecimentos:'Estabelecimentos',venues:'Estabelecimentos',
 mapas:'Mapas e ambientes',maps:'Mapas e ambientes',
 eventos:'Eventos',events:'Eventos',
 produtos:'Produtos',products:'Produtos',avaliacoes:'Avaliações',reviews:'Avaliações',notificacoes:'Notificações',notifications:'Notificações',administradores:'Administradores',admins:'Administradores',preferences:'Preferências'
};
export function parseAdminRoute(pathname:string):AdminRoute{
 const segments=pathname.split('/').filter(Boolean);
 const section=sectionBySegment[segments[0]]||'Visão geral';
 if(section==='Visão geral'||section==='Estatísticas'||section==='Produtos'||section==='Avaliações'||section==='Notificações'||section==='Administradores'||section==='Preferências')return {section,id:null,creating:false};
 if(section==='Eventos'&&segments.length===3&&['menu','cardapio'].includes(segments[2])){
  try{const id=decodeURIComponent(segments[1]);if(id&&!['new','novo'].includes(id))return {section,id,creating:false,menu:true};}catch{}
  return {section,id:null,creating:false};
 }
 if(section==='Estabelecimentos'&&segments.length===5&&segments[2]==='events'&&segments[4]==='analysis'){
  try{
   const id=decodeURIComponent(segments[1]),eventId=decodeURIComponent(segments[3]);
   if(id&&eventId&&!['new','novo'].includes(id))return {section,id,creating:false,eventId};
  }catch{}
  return {section,id:null,creating:false};
 }
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
 if(route.section==='Visão geral'||route.section==='Estatísticas'||route.section==='Produtos'||route.section==='Administradores'||route.section==='Preferências')return base;
 if(route.section==='Eventos'&&route.id&&route.menu)return base+'/'+encodeURIComponent(route.id)+'/menu';
 if(route.section==='Estabelecimentos'&&route.id&&route.eventId)
  return base+'/'+encodeURIComponent(route.id)+'/events/'+encodeURIComponent(route.eventId)+'/analysis';
 if(route.section==='Estabelecimentos'&&route.id&&route.analytics)return base+'/'+encodeURIComponent(route.id)+'/analytics';
 if(route.section==='Estabelecimentos'&&route.id&&route.mapId)
  return base+'/'+encodeURIComponent(route.id)+'/maps/'+encodeURIComponent(route.mapId);
 if(route.creating)return base+'/new';
 if(route.id)return base+'/'+encodeURIComponent(route.id);
 return base;
}

/** Valida deep links do painel, inclusive /events/:id/menu após F5. */
export function isKnownAdminPath(pathname:string):boolean{
 const pathParts=pathname.split('/').filter(Boolean);
 return (pathParts.length===5&&['venues','estabelecimentos'].includes(pathParts[0])&&pathParts[2]==='events'&&pathParts[4]==='analysis'&&!!pathParts[1]&&!!pathParts[3])||pathParts.length===0||(pathParts.length===3&&['venues','estabelecimentos'].includes(pathParts[0])&&pathParts[2]==='analytics'&&!!pathParts[1])||(pathParts.length===1&&['venues','events','products','maps','preferences','reviews','notifications','administradores','admins','intelligence','inteligencia','statistics','estatisticas','estabelecimentos','eventos','produtos','mapas'].includes(pathParts[0]))||(pathParts.length===2&&['venues','events','maps','estabelecimentos','eventos','mapas'].includes(pathParts[0])&&!!pathParts[1])||(pathParts.length===4&&['venues','estabelecimentos'].includes(pathParts[0])&&['maps','mapas'].includes(pathParts[2])&&!!pathParts[1]&&!!pathParts[3])||(pathParts.length===3&&['events','eventos'].includes(pathParts[0])&&!!pathParts[1]&&['menu','cardapio'].includes(pathParts[2]));
}
