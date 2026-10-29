/**
 * Database selection must be explicit in production. A typo or missing
 * DATABASE_URL cannot quietly start a new empty SQLite database.
 */
export function databaseMode(env=process.env){
 const url=String(env.DATABASE_URL||'').trim();
 const production=env.NODE_ENV==='production'||env.APP_ENV==='production';
 if(!url){
  if(production)throw Error('DATABASE_URL é obrigatória em produção; SQLite está desabilitado.');
  return 'sqlite';
 }
 if(!/^postgres(?:ql)?:\/\//i.test(url))throw Error('DATABASE_URL deve ser uma conexão PostgreSQL.');
 return 'postgresql';
}
