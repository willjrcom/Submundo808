import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {venueLocation,completeVenueAddress} from '../artifacts/submundo-808/src/venue-address.ts';

test('legacy tour addresses hydrate the editable fields',()=>{
 const fortaleza=venueLocation({city:'Fortaleza - CE',address:'R. Almirante Jaceguai, 19 - Centro, Fortaleza - CE, 60060-210, Brasil'});
 assert.deepEqual(fortaleza,{postalCode:'60060-210',street:'R. Almirante Jaceguai, 19',neighborhood:'Centro'});
 const brasilia=venueLocation({city:'Brasília - DF',address:'Eixo Monumental - SRPN - Asa Norte, Brasília - DF, 70070-701, Brasil'});
 assert.deepEqual(brasilia,{postalCode:'70070-701',street:'Eixo Monumental - SRPN',neighborhood:'Asa Norte'});
 const bauru=venueLocation({city:'Bauru - SP',address:'R. Quatro, 425 - Jardim Santos Dumont, Bauru - SP, Brasil'});
 assert.deepEqual(bauru,{postalCode:'',street:'R. Quatro, 425',neighborhood:'Jardim Santos Dumont'});
});

test('structured venue fields take precedence over inferred address values',()=>{
 assert.deepEqual(venueLocation({city:'Fortaleza - CE',address:'Rua Antiga - Centro, Fortaleza - CE, 60060-210, Brasil',street:'Rua Nova, 1',neighborhood:'Praia',postal_code:'60000-001'}),{postalCode:'60000-001',street:'Rua Nova, 1',neighborhood:'Praia'});
});

test('saving structured fields updates the address shown in cards and event details',()=>{
 assert.equal(completeVenueAddress('Rua Nova, 20','Centro','Fortaleza - CE','60000-001','Rua Antiga, 9 - Centro, Fortaleza - CE, Brasil'),'Rua Nova, 20 - Centro, Fortaleza - CE, 60000-001, Brasil');
 assert.equal(completeVenueAddress('','','Fortaleza - CE','','Endereço não estruturado'),'Endereço não estruturado');
});

test('form values are bright and placeholders remain visually distinguishable across the app',()=>{
 const css=readFileSync(new URL('../artifacts/submundo-808/src/index.css',import.meta.url),'utf8');
 assert.match(css,/Unlayered rules/);
 assert.match(css,/color: #faf8ff;/);
 assert.match(css,/input, textarea\)::placeholder/);
 const shell=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
 assert.match(shell,/const location=venueLocation\(editing\)/);
 assert.match(shell,/address:completeVenueAddress\(street,neighborhood,city,postalCode,address\)/);
});
