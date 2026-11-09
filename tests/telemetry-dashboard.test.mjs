import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
const panel=read('artifacts/submundo-808/src/components/admin-usage.tsx');
const client=read('artifacts/submundo-808/src/components/usage-telemetry.ts');
const app=read('artifacts/submundo-808/src/App.tsx');
const server=read('server/index.mjs');

test('Home integra dashboard completo e conserva os contadores operacionais',()=>{
  assert.match(shell,/section==='Visão geral'&&<AdminUsage events=\{events\}/);
  assert.match(shell,/sharingNow=\{stats.sharingNow\}/);
  assert.match(shell,/onlineUsers=\{stats.activeUsers\}/);
  assert.match(shell,/totalEvents=\{events.length\}/);
  assert.match(shell,/onOpenEvent=\{id=>go\(\{section:'Eventos',id,creating:false\}\)\}/);
  assert.match(panel,/Uso do aplicativo ao longo do tempo/);
  assert.match(panel,/Uso por funcionalidade/);
  assert.match(panel,/Retorno de usuários/);
  assert.match(panel,/Tempo médio de uso/);
  assert.match(panel,/Exportar CSV/);
  assert.match(panel,/Últimos 7 dias/);
  assert.match(panel,/Personalizado/);
  assert.match(panel,/Ainda não há acessos registrados/);
});

test('API e frontend enviam sessões com pausa, sem consumir telemetria no admin',()=>{
  assert.match(client,/sessionId: sessionId\(\)/);
  assert.match(client,/document.visibilityState !== 'visible'/);
  assert.match(app,/pauseEventUsage\(activeEventId\)/);
  assert.match(app,/reportEventUsage\(activeEventId,'heartbeat'\)/);
  assert.match(server,/readEventUsage\(db,\{/);
  assert.match(server,/period:url.searchParams.get\('period'\)/);
  assert.match(server,/if\(!isAdmin\(user\)\)return json\(res,403/);
});
