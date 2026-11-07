import test from 'node:test';
import assert from 'node:assert/strict';
import {venueMediaFields} from '../server/venue-media.mjs';
import {readFileSync} from 'node:fs';

test('venue cover and logo are preserved for edits that omit the fields',()=>{
 const image='data:image/webp;base64,YWJj';
 assert.deepEqual(venueMediaFields({}, {cover_image:image,logo_image:''}),{cover_image:image,logo_image:''});
 assert.deepEqual(venueMediaFields({cover_image:''},{cover_image:image,logo_image:image}),{cover_image:'',logo_image:image});
});
test('media payload rejects oversized, unsafe and invalid formats',()=>{
 assert.throws(()=>venueMediaFields({cover_image:'https://not-a-data-uri.test/'}),/Imagem/);
 assert.throws(()=>venueMediaFields({cover_image:'data:image/svg+xml;base64,YWJj'}),/Imagem/);
 assert.throws(()=>venueMediaFields({cover_image:'data:image/webp;base64,'+'a'.repeat(120000)}),/Imagem/);
 assert.equal(venueMediaFields({cover_image:'data:image/jpeg;base64,YWJj'}).cover_image.startsWith('data:image/jpeg'),true);
});
test('venue image columns are maintained across schema migration and admin mutations',()=>{
 const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 assert.match(server,/\['cover_image',"TEXT NOT NULL DEFAULT ''"\]/);
 assert.match(server,/\['logo_image',"TEXT NOT NULL DEFAULT ''"\]/);
 assert.match(server,/venues SET name=\?,address=\?,city=\?/);
 assert.match(server,/media\.cover_image,media\.logo_image/);
});
