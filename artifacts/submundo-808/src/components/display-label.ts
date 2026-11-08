// Mantém IDs e nomes originais no banco, mas oculta sufixos antigos da interface.
// Assim não criamos duplicatas nem alteramos registros editáveis do administrador.
export function displayLabel(value:string|undefined|null):string{
 return String(value||'')
  .replace(/\s*[—–-]\s*(?:Edição\s+)?(?:Demo|Demonstração|Teste)\s*$/i,'')
  .trim();
}

// Oculta apenas avisos de amostra que vieram de dados já persistidos.
export function displayPublicDescription(value:string|undefined|null):string{
 const text=String(value||'').trim();
 return /^(?:DEMONSTRAÇÃO|DEMO|DEMONSTRATIVO|EXEMPLO|FICTÍCIO|ILUSTRATIVO)\s*[:—–-]/i.test(text)?'':text;
}

export function displayDescription(value:string|undefined|null):string{
 const description=String(value||'');
 // Descrição padrão da antiga rotina de geração; não é conteúdo do evento.
 if(/^Evento demonstrativo completo para testar a experiência do participante\./i.test(description))return '';
 return displayPublicDescription(description);
}

export function displayAddress(value:string|undefined|null):string{
 const address=String(value||'');
 if(/^Endereço fictício para testes$/i.test(address.trim()))return '';
 return address;
}
