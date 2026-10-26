/** Formata celular brasileiro progressivamente durante a digitação. */
export function formatMobile(value:string):string {
 const digits=value.replace(/\D/g,'').slice(0,11);
 if(!digits)return '';
 if(digits.length<=2)return '('+digits;
 if(digits.length<=7)return '('+digits.slice(0,2)+') '+digits.slice(2);
 return '('+digits.slice(0,2)+') '+digits.slice(2,7)+'-'+digits.slice(7);
}
export const mobileDigits=(value:string)=>value.replace(/\D/g,'').slice(0,11);
