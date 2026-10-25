// Catálogo fictício para a funcionalidade "Gerar evento e DJs de teste".
// Os IDs estáveis permitem executar o seed várias vezes sem duplicar produtos.
export const DEMO_PRODUCTS = [
  {id:'demo-product-agua-500',name:'Água mineral 500 ml',category:'Bebidas',price:700,eventPrice:600},
  {id:'demo-product-refrigerante',name:'Refrigerante lata',category:'Bebidas',price:1000,eventPrice:null},
  {id:'demo-product-suco',name:'Suco natural',category:'Bebidas',price:1400,eventPrice:null},
  {id:'demo-product-energetico',name:'Energético lata',category:'Bebidas',price:1700,eventPrice:1600},
  {id:'demo-product-cerveja-lata',name:'Cerveja lata',category:'Bebidas',price:1200,eventPrice:null},
  {id:'demo-product-cerveja-long-neck',name:'Cerveja long neck',category:'Bebidas',price:1600,eventPrice:null},
  {id:'demo-product-caipirinha',name:'Caipirinha',category:'Drinks',price:2800,eventPrice:2600},
  {id:'demo-product-gin-tonica',name:'Gin tônica',category:'Drinks',price:3400,eventPrice:null},
  {id:'demo-product-drink-casa',name:'Drink da casa',category:'Drinks',price:3200,eventPrice:3000},
  {id:'demo-product-hamburguer',name:'Hambúrguer artesanal',category:'Comidas',price:3500,eventPrice:null},
  {id:'demo-product-batata-frita',name:'Batata frita',category:'Comidas',price:2400,eventPrice:2200},
  {id:'demo-product-hot-dog',name:'Cachorro-quente',category:'Comidas',price:2000,eventPrice:null},
  {id:'demo-product-pizza-fatia',name:'Fatia de pizza',category:'Comidas',price:1800,eventPrice:null},
  {id:'demo-product-vegetariano',name:'Opção vegetariana',category:'Comidas',price:2900,eventPrice:null}
];

// Deve ser chamada dentro da mesma transação de criação/atualização da demonstração.
// Não altera produtos existentes nem os preços de cardápios já personalizados.
export function seedDemoProducts(db,eventId,now=Date.now()){
  const existingProduct=db.prepare('SELECT id FROM products WHERE id=?');
  const existingLink=db.prepare('SELECT 1 FROM event_products WHERE event_id=? AND product_id=?');
  const insertProduct=db.prepare('INSERT INTO products(id,name,description,category,default_price_cents,created_at) VALUES(?,?,?,?,?,?)');
  const insertLink=db.prepare('INSERT INTO event_products(event_id,product_id,price_cents) VALUES(?,?,?)');
  let productsCreated=0,productsLinked=0;
  for(const p of DEMO_PRODUCTS){
    if(!existingProduct.get(p.id)){
      insertProduct.run(p.id,p.name,'Produto fictício para demonstração do cardápio.',p.category,p.price,now);
      productsCreated++;
    }
    if(!existingLink.get(eventId,p.id)){
      insertLink.run(eventId,p.id,p.eventPrice);
      productsLinked++;
    }
  }
  return {productsCreated,productsLinked,productsTotal:DEMO_PRODUCTS.length};
}
