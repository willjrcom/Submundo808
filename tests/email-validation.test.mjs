import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidEmailAddress} from '../server/email-validation.mjs';

test('valida e-mail convencional e bloqueia dados inválidos no cadastro',()=>{
 assert.equal(isValidEmailAddress('pg-test-20261027@example.invalid'),true);
 assert.equal(isValidEmailAddress('usuario+app@gmail.com'),true);
 for(const bad of ['', 'sem-arroba', 'abc@', 'abc@servidor', 'a b@host.com', 'abc@@host.com'])assert.equal(isValidEmailAddress(bad),false,bad);
});
