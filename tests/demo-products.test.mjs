import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {DEMO_PRODUCTS,seedDemoProducts} from '../server/demo-products.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,default_price_cents INTEGER NOT NULL,created_at INTEGER NOT NULL)");
 db.exec('CREATE TABLE event_products(event_id TEXT NOT NULL,product_id TEXT NOT NULL,price_cents INTEGER,PRIMARY KEY(event_id,product_id))');
 return db;
}
test('gera catálogo e vincula 14 produtos ao evento de demonstração',()=>{
 const db=fixture();
 try{
  const result=seedDemoProducts(db,'evento-demo',123456);
  assert.deepEqual(result,{productsCreated:14,productsLinked:14,productsTotal:14});
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,14);
  assert.equal(db.prepare('SELECT count(*) n FROM event_products WHERE event_id=?').get('evento-demo').n,14);
  assert.deepEqual([...new Set(DEMO_PRODUCTS.map(p=>p.category))].sort(),['Bebidas','Comidas','Drinks']);
  const water=db.prepare('SELECT p.default_price_cents, ep.price_cents FROM products p JOIN event_products ep ON ep.product_id=p.id WHERE p.id=?').get('demo-product-agua-500');
  assert.equal(water.default_price_cents,700);
  assert.equal(water.price_cents,600);
 }finally{db.close();}
});
test('executar novamente não duplica produtos nem vínculos',()=>{
 const db=fixture();
 try{
  seedDemoProducts(db,'evento-demo');
  const again=seedDemoProducts(db,'evento-demo');
  assert.deepEqual(again,{productsCreated:0,productsLinked:0,productsTotal:14});
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,14);
  assert.equal(db.prepare('SELECT count(*) n FROM event_products').get().n,14);
 }finally{db.close();}
});
test('não substitui nomes, descrições nem preços personalizados',()=>{
 const db=fixture();
 try{
  seedDemoProducts(db,'evento-demo');
  db.prepare('UPDATE products SET name=?,default_price_cents=? WHERE id=?').run('Água personalizada',800,'demo-product-agua-500');
  db.prepare('UPDATE event_products SET price_cents=? WHERE event_id=? AND product_id=?').run(499,'evento-demo','demo-product-agua-500');
  seedDemoProducts(db,'evento-demo');
  const saved=db.prepare('SELECT p.name,p.default_price_cents,ep.price_cents FROM products p JOIN event_products ep ON p.id=ep.product_id WHERE p.id=?').get('demo-product-agua-500');
  assert.deepEqual(saved,{name:'Água personalizada',default_price_cents:800,price_cents:499});
 }finally{db.close();}
});
test('completa produtos ausentes de um evento de teste já criado',()=>{
 const db=fixture();
 try{
  seedDemoProducts(db,'evento-demo');
  db.prepare('DELETE FROM event_products WHERE event_id=? AND product_id=?').run('evento-demo','demo-product-suco');
  const restored=seedDemoProducts(db,'evento-demo');
  assert.equal(restored.productsCreated,0);
  assert.equal(restored.productsLinked,1);
  assert.equal(db.prepare('SELECT count(*) n FROM event_products').get().n,14);
 }finally{db.close();}
});
test('outro evento reutiliza o catálogo global sem duplicar produtos',()=>{
 const db=fixture();
 try{
  seedDemoProducts(db,'evento-demo');
  const other=seedDemoProducts(db,'evento-extra');
  assert.equal(other.productsCreated,0);
  assert.equal(other.productsLinked,14);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,14);
  assert.equal(db.prepare('SELECT count(*) n FROM event_products').get().n,28);
 }finally{db.close();}
});
