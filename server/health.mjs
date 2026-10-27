// Health check intencionalmente mínimo: não expõe banco, host, paths ou segredos.
export function readHealth(db){
 try{return {ok:db.prepare('SELECT 1 AS ok').get()?.ok===1};}
 catch{return {ok:false};}
}
