export type AgendaEvent={id:string;name:string;starts_at?:string;ends_at?:string};
export type AgendaGroups<T>={live:T[];upcoming:T[];past:T[];undated:T[]};
export function groupPublicEvents<T extends AgendaEvent>(events:readonly T[],nowMs:number,parseTimestamp:(value?:string)=>number|null):AgendaGroups<T>;
