import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOauth} from '../server/oauth.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const account=read('artifacts/submundo-808/src/components/account.tsx');
const server=read('server/index.mjs');

test('formulário de e-mail mostra Voltar no topo, antes dos campos',()=>{
 const form=account.indexOf('<form onSubmit={submit} className="space-y-4');
 const back=account.indexOf('Voltar para outras formas de entrar',form);
 const email=account.indexOf("['login','forgot','register'].includes(mode)",form);
 const loginButton=account.indexOf("mode==='register'?'Criar conta'",form);
 assert.ok(form>=0 && back>form && email>back && loginButton>email);
 assert.match(account,/onClick=\{\(\)=>\{setEmailLoginOpen\(false\);setError\(''\);setPassword\(''\);\}\}/);
 assert.match(account,/mode!=='login'&&<button[^>]+onClick=\{\(\)=>change\('login'\)\}/);
 assert.equal(account.split('Voltar para outras formas de entrar').length-1,1);
});

test('criação de admin é apresentada só quando o servidor habilita e preserva credenciais',()=>{
 assert.match(account,/providers\.demoAdmin&&<button/);
 assert.match(account,/Criar usuário admin/);
 assert.match(account,/if\(busy\|\|!providers\.demoAdmin\)return/);
 assert.match(account,/request\('demo-admin',\{\}\)/);
 assert.match(account,/if\(!me\.user\?\.isAdmin\)/);
 assert.match(account,/setAdminCredentials\(\{email:created\.user\.email,password:created\.password\}\)/);
 assert.match(account,/Credenciais do administrador criado/);
 assert.match(account,/Copiar credenciais/);
 assert.doesNotMatch(account,/localStorage\.setItem\('submundo-demo-email'/);
 assert.match(server,/process\.env\.ENABLE_DEMO_USERS!=='true' \|\| process\.env\.ENABLE_DEMO_ADMIN!=='true'/);
 assert.match(server,/INSERT INTO admin_users\(user_id,created_at,role\) VALUES/);
});

test('o endpoint de provedores só oferece admin de teste com duas flags explícitas',async()=>{
 const priorUsers=process.env.ENABLE_DEMO_USERS;
 const priorAdmin=process.env.ENABLE_DEMO_ADMIN;
 const handle=createOauth({db:{exec(){}},secret:'test-secret',getUser:()=>null,createSession(){},passwordHash:()=>''});
 async function capabilities(){
  let status=0,body='';
  const res={writeHead(code){status=code;},end(content){body=content;}};
  await handle({method:'GET'},res,new URL('https://local.invalid/api/auth/providers'));
  assert.equal(status,200);
  return JSON.parse(body);
 }
 try{
  process.env.ENABLE_DEMO_USERS='false';process.env.ENABLE_DEMO_ADMIN='true';
  assert.equal((await capabilities()).demoAdmin,false);
  process.env.ENABLE_DEMO_USERS='true';process.env.ENABLE_DEMO_ADMIN='false';
  assert.equal((await capabilities()).demoAdmin,false);
  process.env.ENABLE_DEMO_USERS='true';process.env.ENABLE_DEMO_ADMIN='true';
  assert.equal((await capabilities()).demoAdmin,true);
 }finally{
  if(priorUsers===undefined)delete process.env.ENABLE_DEMO_USERS;else process.env.ENABLE_DEMO_USERS=priorUsers;
  if(priorAdmin===undefined)delete process.env.ENABLE_DEMO_ADMIN;else process.env.ENABLE_DEMO_ADMIN=priorAdmin;
 }
});
