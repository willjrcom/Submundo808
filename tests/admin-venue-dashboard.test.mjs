import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const venue=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-dashboard.tsx',import.meta.url),'utf8');
const maps=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-venue-maps.tsx',import.meta.url),'utf8');
test('venue dashboard has photo, logo, edit, maps and events without tabs',()=>{
 for(const field of ['venue.cover_image','venue.logo_image','onEdit','AdminVenueMaps','relatedEvents.map','onOpenEvent'])assert.ok(venue.includes(field),field);
 assert.doesNotMatch(venue,/role="tablist"|aria-selected=/);
 assert.match(maps,/aria-label="Carrossel de plantas do local"/);
 assert.match(maps,/aria-label=\{'Abrir planta '\+map\.name\}/);
});
test('map card preview is grounded in saved rooms rather than fabricated images',()=>{
 assert.match(maps,/api\/admin\/areas/);
 assert.match(maps,/areas.filter\(area=>area.map_id===map.id\)/);
 assert.doesNotMatch(maps,/Unsplash|placehold\.co|demo.*image/);
});
