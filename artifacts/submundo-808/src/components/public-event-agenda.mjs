/**
 * Agrupa eventos da agenda pública considerando o encerramento real da festa.
 * A conversão das datas é injetada para reutilizar o parser da programação,
 * inclusive para datetimes locais de America/Sao_Paulo e eventos noturnos.
 */
export function groupPublicEvents(events,nowMs,parseTimestamp){
 const live=[],upcoming=[],past=[],undated=[];
 const parsed=(value)=>{
  const result=parseTimestamp(value);
  return typeof result==='number'&&Number.isFinite(result)?result:null;
 };
 for(const event of events){
  const start=parsed(event.starts_at);
  const end=parsed(event.ends_at);
  if(end!==null&&(start===null||end>start)&&end<=nowMs){
   past.push(event);
  }else if(start!==null&&start>nowMs){
   upcoming.push(event);
  }else if(start!==null&&end!==null&&end>start&&start<=nowMs&&nowMs<end){
   live.push(event);
  }else{
   // Sem um horário de fim válido não é seguro declarar que o evento acabou.
   undated.push(event);
  }
 }
 const byName=(a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id);
 const byTime=(accessor,ascending=true)=>(a,b)=>{
  const at=parsed(accessor(a)),bt=parsed(accessor(b));
  if(at===null&&bt!==null)return 1;
  if(bt===null&&at!==null)return -1;
  const order=(at===null||bt===null)?0:(ascending?at-bt:bt-at);
  return order||byName(a,b);
 };
 live.sort(byTime(e=>e.ends_at));
 upcoming.sort(byTime(e=>e.starts_at));
 past.sort(byTime(e=>e.ends_at||e.starts_at,false));
 undated.sort(byTime(e=>e.starts_at));
 return {live,upcoming,past,undated};
}
