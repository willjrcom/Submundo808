/** DJ scheduling for Submundo 808 events.
 * The editor saves datetime-local (without timezone) for the event venue in
 * Sorocaba. Interpret those times in America/Sao_Paulo, not the viewer's zone.
 * This also works from cached lineups without any network request.
 */
export const EVENT_TIME_ZONE='America/Sao_Paulo';

export type ScheduledDJ={nome:string;inicio?:string;fim?:string;instagram?:string;spotify?:string};
export type DJStatus='live'|'next'|'later'|'finished'|'unscheduled';
export type DJSlot={
 dj:ScheduledDJ;index:number;startMs:number|null;endMs:number|null;
 status:DJStatus;progress:number;timeLabel:string;
};
const fullLocal=/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d))?$/;
const clockOnly=/^(\d\d):(\d\d)$/;
const zonedFormatter=new Intl.DateTimeFormat('en-GB',{
 timeZone:EVENT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
});
const hourFormatter=new Intl.DateTimeFormat('pt-BR',{
 timeZone:EVENT_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const dayFormatter=new Intl.DateTimeFormat('en-CA',{
 timeZone:EVENT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
});

function localParts(timestamp:number):{year:number;month:number;day:number;hour:number;minute:number;second:number}{
 const parts=Object.fromEntries(zonedFormatter.formatToParts(new Date(timestamp)).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
 return {year:parts.year,month:parts.month,day:parts.day,hour:parts.hour,minute:parts.minute,second:parts.second};
}
function localDateToTimestamp(y:number,m:number,d:number,h:number,min:number,sec=0):number|null{
 if(m<1||m>12||d<1||d>31||h>23||min>59||sec>59)return null;
 const naiveUtc=Date.UTC(y,m-1,d,h,min,sec);
 const test=new Date(naiveUtc);
 if(test.getUTCFullYear()!==y||test.getUTCMonth()+1!==m||test.getUTCDate()!==d)return null;
 let current=naiveUtc;
 // Iteration accounts for changes to the actual Sao Paulo UTC offset.
 for(let attempt=0;attempt<3;attempt++){
  const actual=localParts(current);
  const asUtc=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second);
  const correction=naiveUtc-asUtc;
  if(!correction)break;
  current+=correction;
 }
 const actual=localParts(current);
 return actual.year===y&&actual.month===m&&actual.day===d&&
  actual.hour===h&&actual.minute===min&&actual.second===sec?current:null;
}
export function parseEventTimestamp(value?:string):number|null{
 const text=(value||'').trim();
 if(!text)return null;
 const local=fullLocal.exec(text);
 if(local)return localDateToTimestamp(Number(local[1]),Number(local[2]),Number(local[3]),Number(local[4]),Number(local[5]),Number(local[6]||0));
 // Accept ISO timestamps explicitly containing an offset or UTC marker.
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/i.test(text)){
  const parsed=Date.parse(text);
  return Number.isFinite(parsed)?parsed:null;
 }
 return null;
}
function calendarDay(value:number):string {
 const parts=Object.fromEntries(dayFormatter.formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function resolveDJTimestamp(value:string|undefined,eventStartsAt:string,previousStart?:number|null):number|null{
 const full=parseEventTimestamp(value);
 if(full!==null)return full;
 const m=clockOnly.exec((value||'').trim());
 if(!m)return null;
 const hours=Number(m[1]),minutes=Number(m[2]);
 if(hours>23||minutes>59)return null;
 const eventStart=parseEventTimestamp(eventStartsAt);
 if(eventStart===null)return null;
 const localStart=localParts(eventStart);
 // Legacy HH:mm-only lineups inherit the event's date. A clock time before
 // the event begins belongs to the following day (e.g. 01:00 in a 22:00 show).
 let day=localStart.day,month=localStart.month,year=localStart.year;
 if(hours*60+minutes<localStart.hour*60+localStart.minute){
  const next=new Date(Date.UTC(year,month-1,day+1));
  year=next.getUTCFullYear();month=next.getUTCMonth()+1;day=next.getUTCDate();
 }
 let resolved=localDateToTimestamp(year,month,day,hours,minutes);
 // End times earlier than their DJ's start cross midnight.
 if(resolved!==null&&previousStart!==undefined&&previousStart!==null&&resolved<=previousStart){
  const next=new Date(Date.UTC(year,month-1,day+1));
  resolved=localDateToTimestamp(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate(),hours,minutes);
 }
 return resolved;
}
function displayedHour(value:string|undefined,ms:number|null):string{
 if(ms!==null)return hourFormatter.format(new Date(ms));
 const plain=clockOnly.exec((value||'').trim());
 return plain&&Number(plain[1])<24&&Number(plain[2])<60?plain[1]+':'+plain[2]:'A definir';
}
export function getDJTimeline(djs:readonly ScheduledDJ[],eventStart:string,nowMs=Date.now()):DJSlot[]{
 const slots=djs.map((dj,index)=>{
  const startMs=resolveDJTimestamp(dj.inicio,eventStart);
  const endMs=resolveDJTimestamp(dj.fim,eventStart,startMs);
  const valid=startMs!==null&&endMs!==null&&endMs>startMs;
  const nextDay=valid&&calendarDay(startMs)!==calendarDay(endMs);
  const timeLabel=displayedHour(dj.inicio,startMs)+' — '+displayedHour(dj.fim,endMs)+(nextDay?' (+1 dia)':'');
  return {dj,index,startMs:valid?startMs:null,endMs:valid?endMs:null,status:'unscheduled' as DJStatus,progress:0,timeLabel};
 }).sort((a,b)=>(a.startMs??Number.POSITIVE_INFINITY)-(b.startMs??Number.POSITIVE_INFINITY)||a.index-b.index);
 // Do not show a false LIVE label for an overlapping or unconfigured interval.
 const live=slots.filter(slot=>slot.startMs!==null&&slot.endMs!==null&&slot.startMs<=nowMs&&nowMs<slot.endMs)
  .sort((a,b)=>b.startMs!-a.startMs!)[0];
 const next=slots.find(slot=>slot.startMs!==null&&slot.startMs>nowMs);
 return slots.map(slot=>{
  if(slot.startMs===null||slot.endMs===null)return slot;
  const status:DJStatus=slot===live?'live':slot.endMs<=nowMs?'finished':slot===next?'next':'later';
  const progress=status==='live'?Math.min(100,Math.max(0,Math.round((nowMs-slot.startMs)/(slot.endMs-slot.startMs)*100))):0;
  return {...slot,status,progress};
 });
}
export function formatDJTimeRange(dj:ScheduledDJ,eventStart:string):string{
 return getDJTimeline([dj],eventStart,0)[0]?.timeLabel||'A definir';
}
