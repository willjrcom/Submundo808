// A validação é independente do mecanismo de persistência.
export function isValidEmailAddress(email){
 return typeof email==='string'&&email.length>=3&&email.length<=254&&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
