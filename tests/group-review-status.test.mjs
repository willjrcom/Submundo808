import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const friends=read('artifacts/submundo-808/src/components/friends.tsx');
const notifications=read('artifacts/submundo-808/src/components/notification-center.tsx');
const server=read('server/index.mjs');

test('aba Grupos mantém Sua galera, sem título duplicado, e preserva Meus amigos',()=>{
 assert.match(friends,/>Sua galera<\/p>\{tab==='people'&&<h2/);
 assert.doesNotMatch(friends,/Grupos de amigos/);
 assert.match(friends,/font-black uppercase">Meus amigos<\/h2>/);
});
test('notificação consulta especificamente o evento e não exibe erro de checagem global',()=>{
 assert.match(notifications,/fetch\('\/api\/reviews\?event_id='\+encodeURIComponent\(reviewEvent\)/);
 assert.match(notifications,/typeof result\?\.reviewed!=='boolean'/);
 assert.match(notifications,/reviewed\?'submitted':'ready'/);
 assert.match(notifications,/Sua avaliação já foi enviada\./);
 assert.match(notifications,/reviewStatus==='error'/);
 assert.match(notifications,/setReviewRetry\(value=>value\+1\)/);
 assert.match(notifications,/reviewStatus!=='ready'/);
 assert.match(notifications,/\{!reviewEvent&&error&&<p role="alert"/);
 assert.doesNotMatch(notifications,/Não foi possível verificar se este evento já foi avaliado/);
 assert.doesNotMatch(notifications,/setReviewsLoaded/);
});
test('conflito por prazo encerrado não é tratado como avaliação enviada',()=>{
 assert.match(notifications,/response\.status===409&&result\?\.code==='already_reviewed'/);
 assert.match(server,/code:'already_reviewed'/);
 assert.match(server,/O período de avaliação deste evento terminou/);
 assert.match(server,/eventId,reviewed:hasSubmittedReview\(db,\{eventId,userId:user\.id\}\)/);
 assert.match(server,/if\(!user\)return json\(res,401,\{error:'Faça login para verificar suas avaliações\.'\}\)/);
});
