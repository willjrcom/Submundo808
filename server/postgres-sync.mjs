import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const INT_FIELD=/^(?:id_numeric|ok|n|count|total|recipients|(?:push_(?:tracked|accepted|pending|failed|expired))|attempts|minimum_age|rating|default_price_cents|effective_price_cents|price_cents|is_published|gps_enabled|share_enabled|token_version|first_selected_at|last_selected_at|last_seen|expires_at|created_at|updated_at|sent_at|read_at|scheduled_at|next_attempt_at|lease_until|accepted_at|share_expires_at|lat|lng|accuracy|x|y|width|height|size|spacingMeters|accuracyMeters|quantity|amount)$/;
const INTEGER=/^-?(?:0|[1-9]\d*)$/;
const FLOAT=/^-?(?:\d+\.\d+|\d+\.\d*[eE][+-]?\d+|\d+[eE][+-]?\d+)$/;

// pg-native exposes SQL strings from libpq. Keep identifiers, postal codes,
// phone numbers and other text values exactly as authored in PostgreSQL.
export function normalizePostgresRow(row){
 if(!row||typeof row!=='object')return row;
 const result={...row};
 for(const [key,value] of Object.entries(result)){
  if(typeof value!=='string'||!INT_FIELD.test(key))continue;
  if((INTEGER.test(value)||FLOAT.test(value))&&Number.isFinite(Number(value))&&
      (FLOAT.test(value)||Number.isSafeInteger(Number(value))))result[key]=Number(value);
 }
 return result;
}

// Preserve quoted '?' characters, including SQL string literals containing '??'.
export function parameterize(sql){
 let next=0,quote=null,result='';
 for(let i=0;i<sql.length;i++){
  const ch=sql[i];
  if(quote){result+=ch;
   if(ch===quote){if(sql[i+1]===quote){result+=sql[++i];}else quote=null;}
  }else if(ch==="'"||ch==='"'){quote=ch;result+=ch;}
  else if(ch==='?')result+='$'+(++next);
  else result+=ch;
 }
 return {sql:result,parameters:next};
}

export function postgresSql(source,{ddl=false,run=false}={}){
 let sql=String(source).trim().replace(/;+\s*$/,'');
 if(!sql)return '';
 if(/^PRAGMA journal_mode\s*=\s*WAL$/i.test(sql))return '';
 if(/^BEGIN\s+IMMEDIATE$/i.test(sql))sql='BEGIN';
 if(ddl){
  // SQLite stores timestamps in signed integers; PostgreSQL INTEGER is
  // limited to ~2 billion, so migrate every SQLite INTEGER to BIGINT.
  sql=sql.replace(/\bINTEGER\b/gi,'BIGINT');
 }
 const ignore=/^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
 if(ignore)sql=sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i,'INSERT INTO');
 sql=sql.replace(/\s+COLLATE\s+NOCASE\b/gi,'');
 if(ignore)sql+=' ON CONFLICT DO NOTHING';
 if(run&&/^(?:INSERT|UPDATE|DELETE)\s/i.test(sql)&&!/\bRETURNING\b/i.test(sql)){
  sql+=' RETURNING 1 AS __changed';
 }
 return parameterize(sql).sql;
}

const PRAGMA_INFO=/^PRAGMA\s+table_info\(([a-z][a-z0-9_]*)\)$/i;

export class PostgresSync {
 constructor(url,{Client=null}={}){
  if(typeof url!=='string'||!/^postgres(?:ql)?:\/\//i.test(url))throw Error('DATABASE_URL PostgreSQL inválida.');
  // The current API and notification modules use synchronous prepared queries.
  // pg-native preserves those call sites while using a real remote PostgreSQL.
  // One libpq connection per process, matching the original SQLite writer.
  const Driver=Client||require('pg-native');
  this.client=new Driver();
  this.client.connectSync(url);
  this.closed=false;
  this.querySync("SET statement_timeout = '7s'");
 }
 querySync(query,params){
  if(this.closed)throw Error('Conexão PostgreSQL encerrada');
  return this.client.querySync(query,params&&params.length?params:undefined)||[];
 }
 exec(source){
  // PostgreSQL simple query protocol can execute multi-statement DDL.
  const sql=String(source).replace(/^\s*PRAGMA\s+journal_mode\s*=\s*WAL;?/i,'').trim();
  if(!sql)return;
  const query=postgresSql(sql,{ddl:/\b(?:CREATE|ALTER)\s+TABLE\b/i.test(sql)});
  if(query)this.querySync(query);
 }
 prepare(source){
  const pragma=String(source).trim().match(PRAGMA_INFO);
  if(pragma){
   const table=pragma[1];
   return {
    all:()=>this.querySync("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position",[table]),
    get:()=>this.querySync("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position LIMIT 1",[table])[0],
    run:()=>{throw Error('PRAGMA table_info é somente leitura');}
   };
  }
  const plain=postgresSql(source),mutation=postgresSql(source,{run:true});
  const execute=(query,values)=>this.querySync(query,values).map(normalizePostgresRow);
  return {
   get:(...values)=>execute(plain,values)[0],
   all:(...values)=>execute(plain,values),
   run:(...values)=>({changes:execute(mutation,values).length})
  };
 }
 close(){
  if(this.closed)return;
  this.closed=true;
  this.client.endSync?.();
 }
}
