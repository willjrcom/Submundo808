export type EventPeriod='upcoming'|'today'|'past'|'all';
export type EventStatus='live'|'upcoming'|'past'|'undated';
export type EventRecord={id:string;name:string;venue_id?:string;starts_at?:string;ends_at?:string;map_ids?:string[];lineup?:unknown[]};
export type EventFilters={period:EventPeriod;search:string;venueId:string;month:string};
const parse=(value?:string)=>{if(!value)return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date;};
const localDay=(d:Date)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export function eventStatus(event:EventRecord,now=new Date()):EventStatus{
 const start=parse(event.starts_at);if(!start)return 'undated';
 const end=parse(event.ends_at);
 if(end&&end.getTime()>start.getTime()){if(now.getTime()>=start.getTime()&&now.getTime()<end.getTime())return 'live';return now.getTime()>=end.getTime()?'past':'upcoming';}
 return now.getTime()>=start.getTime()?'past':'upcoming';
}
export function isEventOnDay(event:EventRecord,day:string):boolean{
 const start=parse(event.starts_at);if(!start)return false;
 const end=parse(event.ends_at);const last=end&&end.getTime()>start.getTime()?end:start;
 return localDay(start)<=day&&day<=localDay(last);
}
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function filterAdminEvents<T extends EventRecord>(events:T[],filters:EventFilters,venues:{id:string;name:string}[],now=new Date()):T[]{
 const today=localDay(now),query=fold(filters.search.trim()),venueById=new Map(venues.map(v=>[v.id,v.name]));
 return events.filter(event=>{
  if(filters.venueId&&event.venue_id!==filters.venueId)return false;
  if(filters.month&&!event.starts_at?.startsWith(filters.month))return false;
  if(query&&!fold(event.name+' '+(venueById.get(event.venue_id||'')||'')).includes(query))return false;
  const status=eventStatus(event,now);
  if(filters.period==='upcoming'&&status!=='upcoming'&&status!=='live')return false;
  if(filters.period==='past'&&status!=='past')return false;
  if(filters.period==='today'&&!isEventOnDay(event,today))return false;
  return true;
 }).sort((a,b)=>{
  const rank=(e:T)=>{const s=eventStatus(e,now);return s==='live'?0:s==='upcoming'?1:s==='undated'?2:3;};
  const ap=rank(a),bp=rank(b);if(ap!==bp)return ap-bp;
  const av=parse(a.starts_at)?.getTime()||0,bv=parse(b.starts_at)?.getTime()||0;
  return (ap===3?bv-av:av-bv)||a.name.localeCompare(b.name,'pt-BR');
 });
}
export function eventDayKey(event:EventRecord):string{const d=parse(event.starts_at);return d?localDay(d):'no-date';}
export function groupAdminEvents<T extends EventRecord>(events:T[]){
 const groups=new Map<string,T[]>();
 for(const event of events){const key=eventDayKey(event);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(event);}
 return [...groups].map(([day,items])=>({day,items}));
}
export function availableEventMonths(events:EventRecord[]):string[]{
 return [...new Set(events.map(e=>e.starts_at?.slice(0,7)).filter((m):m is string=>!!m&&m.length===7))].sort().reverse();
}
