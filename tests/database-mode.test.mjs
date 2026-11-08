import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {databaseMode} from '../server/database-mode.mjs';
test('produção sem DATABASE_URL recusa SQLite em vez de criar banco alternativo',()=>{
 for(const env of [{NODE_ENV:'production'},{APP_ENV:'production'},{NODE_ENV:'production',DATABASE_URL:''}]){
  assert.throws(()=>databaseMode(env),/DATABASE_URL é obrigatória em produção/);
 }
});
test('produção usa somente PostgreSQL quando DATABASE_URL é válida',()=>{
 assert.equal(databaseMode({NODE_ENV:'production',DATABASE_URL:'postgresql://example.invalid/db'}),'postgresql');
 assert.throws(()=>databaseMode({APP_ENV:'production',DATABASE_URL:'file:/tmp/example.db'}),/PostgreSQL/);
});
test('SQLite é permitido apenas no modo desenvolvimento, nunca como fallback de produção',()=>{
 assert.equal(databaseMode({NODE_ENV:'development'}),'sqlite');
});
test('status do banco permanece disponível apenas no backend administrativo, sem exposição na interface',()=>{
 const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
 const profile=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-company-profile.tsx',import.meta.url),'utf8');
 assert.match(server,/key==='database-status'.*engine:storageMode/);
 assert.match(ui,/section==='Preferências'&&<AdminCompanyProfile\/>/);
 assert.doesNotMatch(ui,/Banco de dados da aplicação|api\('database-status'\)|PostgreSQL conectado/);
 assert.doesNotMatch(profile,/Banco de dados da aplicação|api\('database-status'\)|PostgreSQL conectado/);
});

test('bootstrap de produção recusa SQLite antes de carregar o servidor',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../server/bootstrap.mjs',import.meta.url))],{
  env:{...process.env,NODE_ENV:'production',APP_ENV:'production',DATABASE_URL:''},
  encoding:'utf8',
  timeout:5000
 });
 assert.equal(result.error,undefined);
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/DATABASE_URL é obrigatória em produção; SQLite está desabilitado/);
 assert.doesNotMatch(result.stdout,/Submundo808 listening/);
});
