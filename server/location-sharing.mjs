// Compartilhamento temporário: o servidor controla o prazo de expiração.
// Não depende de service worker, aba aberta ou timer do dispositivo.
export const SHARING_MODES=Object.freeze(['event','4h','1h']);
export const SHARING_TIME_ZONE='America/Sao_Paulo';
export const LOCATION_FRESH_MS=90_000;
export const MAX_EVENT_AHEAD_MS=30*24*60*60*1000;

export function eventEndTimestamp(value,timeZone=SHARING_TIME_ZONE){
 if(typeof value!=='string'||!value.trim())return null;
 const trimmed=value.trim();
 // Eventos importados podem ter ISO com fuso explícito.
 if(/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)){
  const parsed=Date.parse(trimmed);
  return Number.isFinite(parsed)?parsed:null;
 }
 // A agenda atual grava datetime-local sem fuso: a festa acontece no fuso
 // de São Paulo, não no fuso do container Linux (geralmente UTC).
 const m=trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
 if(!m)return null;
 const [y,mo,d,h,mi,se]=[Number(m[1]),Number(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0)];
 const targetUtc=Date.UTC(y,mo-1,d,h,mi,se);
 const check=new Date(targetUtc);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==mo-1||check.getUTCDate()!==d||check.getUTCHours()!==h||check.getUTCMinutes()!==mi||check.getUTCSeconds()!==se)return null;
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const wallAsUtc=time=>{
  const fields=Object.fromEntries(formatter.formatToParts(new Date(time)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return Date.UTC(fields.year,fields.month-1,fields.day,fields.hour,fields.minute,fields.second);
 };
 let candidate=targetUtc;
 for(let i=0;i<3;i++)candidate+=targetUtc-wallAsUtc(candidate);
 return wallAsUtc(candidate)===targetUtc?candidate:null;
}

export function resolveSharingExpiry(db,{mode,eventId,now=Date.now()}){
 if(!SHARING_MODES.includes(mode))throw Object.assign(new Error('Selecione um prazo de compartilhamento válido.'),{status:400});
 if(mode==='1h')return {mode,eventId:null,expiresAt:now+60*60*1000};
 if(mode==='4h')return {mode,eventId:null,expiresAt:now+4*60*60*1000};
 if(typeof eventId!=='string'||!eventId||eventId.length>100)throw Object.assign(new Error('Escolha um evento para compartilhar até o encerramento.'),{status:400});
 const event=db.prepare('SELECT ends_at FROM events WHERE id=?').get(eventId);
 if(!event)throw Object.assign(new Error('Evento não encontrado.'),{status:404});
 const end=eventEndTimestamp(event.ends_at);
 if(end===null)throw Object.assign(new Error('Defina o horário de término do evento para usar esta opção.'),{status:400});
 if(end<=now)throw Object.assign(new Error('Este evento já terminou. Escolha outro evento ou um prazo em horas.'),{status:400});
 if(end-now>MAX_EVENT_AHEAD_MS)throw Object.assign(new Error('O encerramento está a mais de 30 dias. Escolha um evento mais próximo ou compartilhe por 1 ou 4 horas.'),{status:400});
 return {mode,eventId,expiresAt:end};
}

export function expireLocationShares(db,now=Date.now()){
 // O filtro de leitura também exige expires_at > now, portanto não há janela
 // de exposição mesmo quando a manutenção roda depois do prazo.
 db.prepare('UPDATE location_preferences SET share_enabled=0,gps_enabled=0,updated_at=? WHERE share_enabled=1 AND (share_expires_at IS NULL OR share_expires_at<=?)').run(now,now);
 db.prepare('DELETE FROM live_locations WHERE updated_at<? OR user_id NOT IN (SELECT user_id FROM location_preferences WHERE share_enabled=1 AND share_expires_at>?)').run(now-LOCATION_FRESH_MS,now);
}
