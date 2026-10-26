import products from '@/packages/card-data/one-piece-products.json';

export const normalizeProductCode=(code:string)=>code.toUpperCase().replace(/[^A-Z0-9]/g,'');

export function productCodeForLanguage(code:string,language:string){
  const normalized=normalizeProductCode(code);
  for(const number of ['14','15']){
    if(normalized===`OP${number}`||normalized===`OP${number}EB04`)return language==='JP'?`OP${number}`:`OP${number}-EB04`;
  }
  return code.toUpperCase();
}

export function findSetProduct(code:string,language:string){
  const target=normalizeProductCode(productCodeForLanguage(code,language));
  return products.find(product=>normalizeProductCode(product.code)===target&&product.edition===(language==='JP'?'asia':'global'));
}
