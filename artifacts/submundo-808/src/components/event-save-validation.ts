export type EventDJLink={nome?:string;instagram?:string;spotify?:string};

/** Legacy/seeded DJs may have only a name. Never call trim() on missing social fields. */
export function validateDjLinks(djs:ReadonlyArray<EventDJLink>):string|null{
 for(const dj of djs){
  for(const [platform,value,allowedHosts] of [
   ['Instagram',dj?.instagram,['instagram.com','www.instagram.com']],
   ['Spotify',dj?.spotify,['open.spotify.com']]
  ] as const){
   const raw=(value??'').trim();
   if(!raw)continue;
   try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||!allowedHosts.includes(url.hostname as never)||url.pathname==='/')throw Error('Invalid DJ URL');
   }catch{
    return 'Cole o link completo HTTPS de '+platform+' para '+(dj?.nome||'o DJ')+'.';
   }
  }
 }
 return null;
}

/** Custom form validation is required because inputs in inactive tabs are hidden. */
export function validateEventFields(name:string,venueId:string,starts:string,ends:string,links:string[]):string|null{
 if(!name.trim())return 'Informe o nome do evento.';
 if(!venueId)return 'Selecione o estabelecimento.';
 if(starts&&ends&&(!Number.isFinite(Date.parse(starts))||!Number.isFinite(Date.parse(ends))||Date.parse(ends)<=Date.parse(starts)))
  return 'A data de término precisa ser posterior à data de início.';
 for(const link of links){
  const raw=link.trim();
  if(!raw)continue;
  try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||!url.hostname)throw Error('URL inválida');}
  catch{return 'Preencha os links do evento com URLs válidas (https://...).';}
 }
 return null;
}
