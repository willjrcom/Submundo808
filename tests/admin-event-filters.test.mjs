import test from 'node:test';
import assert from 'node:assert/strict';
import {eventStatus,isEventOnDay,filterAdminEvents,groupAdminEvents,availableEventMonths} from '../artifacts/submundo-808/src/components/admin-event-filters.ts';

const now=new Date('2026-10-26T20:00:00');
const venues=[{id:'v1',name:'Armazém São João'},{id:'v2',name:'Terraço 808'}];
const events=[
 {id:'past',name:'Festa antiga',venue_id:'v1',starts_at:'2026-10-20T20:00',ends_at:'2026-10-21T04:00'},
 {id:'live',name:'Noite 808',venue_id:'v1',starts_at:'2026-10-26T19:00',ends_at:'2026-10-27T03:00'},
 {id:'today',name:'Noite 2',venue_id:'v2',starts_at:'2026-10-26T22:00',ends_at:'2026-10-27T04:00'},
 {id:'later',name:'Sunset',venue_id:'v2',starts_at:'2026-11-03T17:00',ends_at:'2026-11-04T01:00'},
 {id:'undated',name:'Sem data',venue_id:'v1',starts_at:'',ends_at:''}
];
const query=(period,search='',venueId='',month='')=>filterAdminEvents(events,{period,search,venueId,month},venues,now);

test('current, future, past, and unspecified event states are accurate',()=>{
 assert.equal(eventStatus(events[0],now),'past');
 assert.equal(eventStatus(events[1],now),'live');
 assert.equal(eventStatus(events[2],now),'upcoming');
 assert.equal(eventStatus(events[4],now),'undated');
});
test('default upcoming includes active and future events, sorted by start',()=>{
 assert.deepEqual(query('upcoming').map(e=>e.id),['live','today','later']);
});
test('past entries sort newest first, other tabs use date grouping',()=>{
 assert.deepEqual(query('past').map(e=>e.id),['past']);
 assert.deepEqual(groupAdminEvents(query('today')).map(g=>[g.day,g.items.length]),[['2026-10-26',2]]);
});
test('event overnight on a date still counts as active on following day',()=>{
 assert.ok(isEventOnDay(events[1],'2026-10-27'));
 assert.ok(!isEventOnDay(events[1],'2026-10-28'));
});
test('search matches names and venues with accent-insensitive comparison',()=>{
 assert.deepEqual(query('all','armazem').map(e=>e.id),['live','undated','past']);
 assert.deepEqual(query('all','sunset').map(e=>e.id),['later']);
});
test('venue and month filters intersect without changing source list',()=>{
 assert.deepEqual(query('all','','v2','2026-10').map(e=>e.id),['today']);
 assert.deepEqual(availableEventMonths(events),['2026-11','2026-10']);
 assert.equal(events[0].id,'past');
});
