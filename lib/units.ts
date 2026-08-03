import {KITCHEN_CONSTANTS} from "./kitchen-tools";

const round=(n:number,d=1)=>Number(n.toFixed(d));
export const cToF=(c:number)=>c*9/5+32;
export const fToC=(f:number)=>(f-32)*5/9;
export const gToOz=(g:number)=>g/KITCHEN_CONSTANTS.ozG;
export const ozToG=(oz:number)=>oz*KITCHEN_CONSTANTS.ozG;
export const kgToLb=(kg:number)=>kg*1000/KITCHEN_CONSTANTS.lbG;
export const lbToKg=(lb:number)=>lb*KITCHEN_CONSTANTS.lbG/1000;
export const mlToUsCup=(ml:number)=>ml/KITCHEN_CONSTANTS.usCupMl;
export const mlToUsTbsp=(ml:number)=>ml/KITCHEN_CONSTANTS.usTbspMl;
export const mlToUsTsp=(ml:number)=>ml/KITCHEN_CONSTANTS.usTspMl;
export const mlToUsFlOz=(ml:number)=>ml/KITCHEN_CONSTANTS.usFlOzMl;
export const lToUsCup=(l:number)=>l*1000/KITCHEN_CONSTANTS.usCupMl;
export const lToUsQt=(l:number)=>l*1000/KITCHEN_CONSTANTS.usQuartMl;
export const cmToIn=(cm:number)=>cm/KITCHEN_CONSTANTS.inCm;
export const mmToIn=(mm:number)=>mm/(KITCHEN_CONSTANTS.inCm*10);
export function enhanceUnits(text:string):string {
  const converted=text.replace(/摄氏\s*(\d+(?:\.\d+)?)\s*度|(\d+(?:\.\d+)?)\s*(℃|°?C\b|°F\b|kg\b|g\b|克|oz\b|lb\b|ml\b|毫升|L\b|cm\b|mm\b)/gi,(match,celsius,value,unit,offset,whole)=>{
    const before=whole.slice(Math.max(0,offset-3),offset),after=whole.slice(offset+match.length,offset+match.length+4);
    if(before.endsWith("/ ")||after.startsWith(" / "))return match;
    const n=Number(celsius??value),label=(unit??"℃").toLowerCase();
    if(celsius||label==="℃"||label==="c"||label==="°c")return`${n}℃ / ${round(cToF(n),0)}°F`;
    if(label==="°f")return`${n}°F / ${round(fToC(n),0)}℃`;
    if(label==="kg")return`${n} kg / ${round(kgToLb(n))} lb`;
    if(label==="g"||label==="克")return`${n} g / ${round(gToOz(n))} oz`;
    if(label==="oz")return`${n} oz / ${round(ozToG(n))} g`;
    if(label==="lb")return`${n} lb / ${round(lbToKg(n),2)} kg`;
    if(label==="l")return n>=0.75?`${n} L / ${round(lToUsQt(n),2)} US qt`:`${n} L / ${round(lToUsCup(n),2)} US cups`;
    if(label==="cm")return`${n} cm / ${round(cmToIn(n))} in`;
    if(label==="mm")return`${n} mm / ${round(mmToIn(n),2)} in`;
    if(n<=7)return`${n} ml / ${round(mlToUsTsp(n))} US tsp`;
    if(n<=45)return`${n} ml / ${round(mlToUsTbsp(n))} US tbsp`;
    if(n<120)return`${n} ml / ${round(mlToUsFlOz(n),2)} US fl oz`;
    return`${n} ml / ${round(mlToUsCup(n),2)} US cups`;
  });
  return converted.replace(/((?:烤箱|预热|加热|oven|bake)[^\n\d]{0,12})(\d+(?:\.\d+)?)\s*度(?![CF℃])/gi,(_,prefix,n)=>`${prefix}${n}℃ / ${round(cToF(Number(n)),0)}°F`);
}
