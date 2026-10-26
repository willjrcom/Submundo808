// Catálogo fictício para a funcionalidade "Gerar evento e DJs de teste".
// Os IDs estáveis permitem executar o seed várias vezes sem duplicar produtos.
export const DEMO_PRODUCTS = [
  {id:'demo-product-agua-500',description:'Água mineral gelada de 500 ml',name:'Água mineral 500 ml',category:'Bebidas',price:700,eventPrice:600},
  {id:'demo-product-refrigerante',description:'Lata de 350 ml, opções variadas',name:'Refrigerante lata',category:'Bebidas',price:1000,eventPrice:null},
  {id:'demo-product-suco',description:'Sabores selecionados no bar',name:'Suco natural',category:'Bebidas',price:1400,eventPrice:null},
  {id:'demo-product-energetico',description:'Lata gelada, sabores variados',name:'Energético lata',category:'Bebidas',price:1700,eventPrice:1600},
  {id:'demo-product-cerveja-lata',description:'Cerveja gelada, consultar marcas',name:'Cerveja lata',category:'Bebidas',price:1200,eventPrice:null},
  {id:'demo-product-cerveja-long-neck',description:'Garrafa individual, consultar rótulos',name:'Cerveja long neck',category:'Bebidas',price:1600,eventPrice:null},
  {id:'demo-product-caipirinha',description:'Limão, gelo e cachaça',name:'Caipirinha',category:'Drinks',price:2800,eventPrice:2600},
  {id:'demo-product-gin-tonica',description:'Gin, água tônica e cítricos',name:'Gin tônica',category:'Drinks',price:3400,eventPrice:null},
  {id:'demo-product-drink-casa',description:'Drink especial da noite',name:'Drink da casa',category:'Drinks',price:3200,eventPrice:3000},
  {id:'demo-product-hamburguer',description:'Pão, carne e molho da casa',name:'Hambúrguer artesanal',category:'Comidas',price:3500,eventPrice:null},
  {id:'demo-product-batata-frita',description:'Porção crocante individual',name:'Batata frita',category:'Comidas',price:2400,eventPrice:2200},
  {id:'demo-product-hot-dog',description:'Cachorro-quente com acompanhamentos',name:'Cachorro-quente',category:'Comidas',price:2000,eventPrice:null},
  {id:'demo-product-pizza-fatia',description:'Consulte os sabores disponíveis',name:'Fatia de pizza',category:'Comidas',price:1800,eventPrice:null},
  {id:'demo-product-vegetariano',description:'Opção especial sem carne',name:'Opção vegetariana',category:'Comidas',price:2900,eventPrice:null},
  {id:'demo-product-espeto-carne',description:'Espetinho bovino preparado na brasa',name:'Espetinho de carne',category:'Espetinhos',price:1400,eventPrice:null},
  {id:'demo-product-espeto-frango',description:'Espetinho de frango temperado',name:'Espetinho de frango',category:'Espetinhos',price:1200,eventPrice:null},
  {id:'demo-product-espeto-queijo',description:'Espetinho de queijo coalho na brasa',name:'Espetinho de queijo coalho',category:'Espetinhos',price:1300,eventPrice:null},
  {id:'demo-product-x-salada',description:'Hambúrguer com queijo, alface e tomate',name:'X-salada',category:'Lanches',price:2900,eventPrice:null},
  {id:'demo-product-x-bacon',description:'Hambúrguer com queijo e bacon crocante',name:'X-bacon',category:'Lanches',price:3600,eventPrice:null},
  {id:'demo-product-sanduiche-frango',description:'Sanduíche de frango e molho da casa',name:'Sanduíche de frango',category:'Lanches',price:2600,eventPrice:null},
  {id:'demo-product-porcao-calabresa',description:'Calabresa acebolada para compartilhar',name:'Porção de calabresa',category:'Porções',price:3200,eventPrice:null},
  {id:'demo-product-porcao-mandioca',description:'Mandioca frita crocante',name:'Porção de mandioca',category:'Porções',price:2500,eventPrice:null},
  {id:'demo-product-cerveja-pilsen',description:'Garrafa de cerveja pilsen 600 ml',name:'Cerveja pilsen 600 ml',category:'Cervejas',price:1700,eventPrice:null},
  {id:'demo-product-cerveja-puro-malte',description:'Cerveja puro malte long neck',name:'Cerveja puro malte long neck',category:'Cervejas',price:1800,eventPrice:null}
];

// Deve ser chamada dentro da mesma transação de criação/atualização da demonstração.
// Não altera produtos existentes nem os preços de cardápios já personalizados.
export function seedDemoProducts(db,eventId,now=Date.now()){
  const existingProduct=db.prepare('SELECT id FROM products WHERE id=?');
  const existingLink=db.prepare('SELECT 1 FROM event_products WHERE event_id=? AND product_id=?');
  const insertProduct=db.prepare('INSERT INTO products(id,name,description,category,default_price_cents,created_at) VALUES(?,?,?,?,?,?)');
  const insertLink=db.prepare('INSERT INTO event_products(event_id,product_id,price_cents) VALUES(?,?,?)');
  const upgradeDescription=db.prepare('UPDATE products SET description=? WHERE id=? AND description=?');
  let productsCreated=0,productsLinked=0;
  for(const p of DEMO_PRODUCTS){
    if(!existingProduct.get(p.id)){
      insertProduct.run(p.id,p.name,p.description,p.category,p.price,now);
      productsCreated++;
    }else{
      // Ajusta apenas a descrição antiga gerada automaticamente.
      upgradeDescription.run(p.description,p.id,'Produto fictício para demonstração do cardápio.');
    }
    if(!existingLink.get(eventId,p.id)){
      insertLink.run(eventId,p.id,p.eventPrice);
      productsLinked++;
    }
  }
  return {productsCreated,productsLinked,productsTotal:DEMO_PRODUCTS.length};
}
