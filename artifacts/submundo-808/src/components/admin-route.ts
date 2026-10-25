// A URL é a fonte de verdade para a navegação administrativa.
// Mantém seções, formulários e editores abertos após recarregar a página.
export type AdminSection='Visão geral'|'Estabelecimentos'|'Mapas e ambientes'|'Eventos'|'Produtos e cardápios';
export type AdminRoute={section:AdminSection;id:string|null;creating:boolean};
const roots:Record<AdminSection,string>={
 'Visão geral':'/',
 'Estabelecimentos':'/estabelecimentos',
 'Mapas e ambientes':'/mapas',
 'Eventos':'/eventos',
 'Produtos e cardápios':'/produtos'
};
const sectionBySegment:Record<string,AdminSection>={
 estabelecimentos:'Estabelecimentos',
 mapas:'Mapas e ambientes',
 eventos:'Eventos',
 produtos:'Produtos e cardápios'
};
export function parseAdminRoute(pathname:string):AdminRoute{
 const segments=pathname.split('/').filter(Boolean);
 const section=sectionBySegment[segments[0]]||'Visão geral';
 if(section==='Visão geral'||section==='Produtos e cardápios')return {section,id:null,creating:false};
 const detail=segments.length===2?segments[1]:null;
 if(detail==='novo')return {section,id:null,creating:true};
 if(detail){
  try{return {section,id:decodeURIComponent(detail),creating:false};}
  catch{return {section,id:null,creating:false};}
 }
 return {section,id:null,creating:false};
}
export function adminRoutePath(route:AdminRoute):string{
 const base=roots[route.section];
 if(route.section==='Visão geral'||route.section==='Produtos e cardápios')return base;
 if(route.creating)return base+'/novo';
 if(route.id)return base+'/'+encodeURIComponent(route.id);
 return base;
}
