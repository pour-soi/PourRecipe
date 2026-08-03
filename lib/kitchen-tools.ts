export const KITCHEN_CONSTANTS={
  usCupMl:236.5882365,usTbspMl:14.7867648,usTspMl:4.92892159,usFlOzMl:29.5735295625,
  usPintMl:473.176473,usQuartMl:946.352946,lbG:453.59237,ozG:28.349523125,inCm:2.54,butterStickG:113.3980925
} as const;

export type ToolCategory="temperature"|"weight"|"volume"|"length"|"butter"|"baking"|"recipe";
export type Unit="°C"|"°F"|"mg"|"g"|"kg"|"oz"|"lb"|"ml"|"L"|"US fl oz"|"US cup"|"US tbsp"|"US tsp"|"US pint"|"US quart"|"mm"|"cm"|"m"|"in"|"ft"|"stick";
export interface ConversionValue{unit:Unit;value:number;display:string}

const weight:Partial<Record<Unit,number>>={mg:.001,g:1,kg:1000,oz:KITCHEN_CONSTANTS.ozG,lb:KITCHEN_CONSTANTS.lbG};
const volume:Partial<Record<Unit,number>>={ml:1,L:1000,"US fl oz":KITCHEN_CONSTANTS.usFlOzMl,"US cup":KITCHEN_CONSTANTS.usCupMl,"US tbsp":KITCHEN_CONSTANTS.usTbspMl,"US tsp":KITCHEN_CONSTANTS.usTspMl,"US pint":KITCHEN_CONSTANTS.usPintMl,"US quart":KITCHEN_CONSTANTS.usQuartMl};
const length:Partial<Record<Unit,number>>={mm:1,cm:10,m:1000,in:25.4,ft:304.8};

export const unitsByCategory={temperature:["°C","°F"],weight:["mg","g","kg","oz","lb"],volume:["ml","L","US fl oz","US cup","US tbsp","US tsp","US pint","US quart"],length:["mm","cm","m","in","ft"]} as const;
export const exactConvert=(value:number,from:Unit,to:Unit)=>{
  if(from==="°C"&&to==="°F")return value*9/5+32;
  if(from==="°F"&&to==="°C")return(value-32)*5/9;
  if(from===to)return value;
  const table=from in weight?weight:from in volume?volume:from in length?length:null;
  if(!table||table[to]==null||table[from]==null)throw new Error("不兼容的单位");
  return value*table[from]!/table[to]!;
};

export function formatKitchenNumber(value:number,digits=4){
  if(!Number.isFinite(value))return"—";
  const abs=Math.abs(value),places=abs>=100?1:abs>=10?2:abs>=1?2:4;
  return Number(value.toFixed(Math.min(digits,places))).toString();
}

export function equivalents(value:number,from:Unit):ConversionValue[]{
  const units=(from==="°C"||from==="°F")?unitsByCategory.temperature:from in weight?unitsByCategory.weight:from in volume?unitsByCategory.volume:from in length?unitsByCategory.length:[];
  return [...units].filter(unit=>unit!==from).map(unit=>{const converted=exactConvert(value,from,unit);return{unit,value:converted,display:`${formatKitchenNumber(converted)} ${unit}`}});
}

const fractions=[{label:"1/8",value:1/8},{label:"1/4",value:1/4},{label:"1/3",value:1/3},{label:"1/2",value:1/2},{label:"2/3",value:2/3},{label:"3/4",value:3/4}];
export function approximateFraction(value:number,tolerance=.015){
  const whole=Math.trunc(value),decimal=Math.abs(value-whole),candidate=fractions.reduce((best,item)=>Math.abs(item.value-decimal)<Math.abs(best.value-decimal)?item:best,fractions[0]);
  if(Math.abs(candidate.value-decimal)>tolerance)return null;
  const sign=value<0?"-":"",wholeLabel=Math.abs(whole)>0?`${Math.abs(whole)} `:"";
  return`${sign}${wholeLabel}${candidate.label}`;
}

export function butterEquivalents(sticks:number){
  return{sticks,ounces:sticks*4,grams:sticks*KITCHEN_CONSTANTS.butterStickG,tablespoons:sticks*8};
}

export const bakingPanSizes=["6 in","8 in","9 in","10 in","20 cm","23 cm","25 cm"].map(label=>{const [value,unit]=label.split(" ") as [string,"in"|"cm"],n=Number(value);return{label,other:unit==="in"?`${formatKitchenNumber(exactConvert(n,"in","cm"))} cm`:`${formatKitchenNumber(exactConvert(n,"cm","in"))} in`}});

export type RecipeReadingMode="cn-us"|"us-cn";
const withSpace=(value:string)=>value.endsWith(" ")?value:`${value} `;
export function convertRecipeText(text:string,mode:RecipeReadingMode){
  if(mode==="cn-us")return text
    .replace(/(\d+(?:\.\d+)?)\s*(?:克|g\b)/gi,(_,n)=>withSpace(`${n} g / ${Number(exactConvert(Number(n),"g","oz").toFixed(1))} oz`))
    .replace(/(\d+(?:\.\d+)?)\s*(?:千克|公斤|kg\b)/gi,(_,n)=>withSpace(`${n} kg / ${formatKitchenNumber(exactConvert(Number(n),"kg","lb"),3)} lb`))
    .replace(/(\d+(?:\.\d+)?)\s*(?:毫升|ml\b)/gi,(_,n)=>withSpace(`${n} ml / ${formatKitchenNumber(exactConvert(Number(n),"ml","US fl oz"),3)} US fl oz`))
    .replace(/(\d+(?:\.\d+)?)\s*(?:℃|°C\b)/gi,(_,n)=>`${n}℃ / ${formatKitchenNumber(exactConvert(Number(n),"°C","°F"),1)}°F`);
  return text
    .replace(/(\d+(?:\.\d+)?)\s*(?:US\s*)?cups?\b/gi,(_,n)=>`${n} US cup${Number(n)===1?"":"s"}`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:US\s*)?tbsp\b/gi,(_,n)=>`${n} US tbsp`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:US\s*)?tsp\b/gi,(_,n)=>`${n} US tsp`)
    .replace(/(\d+(?:\.\d+)?)\s*°?F\b/gi,(_,n)=>`${n}°F / ${formatKitchenNumber(exactConvert(Number(n),"°F","°C"),1)}℃`)
    .replace(/(\d+(?:\.\d+)?)\s*oz\b/gi,(_,n)=>`${n} oz / ${formatKitchenNumber(exactConvert(Number(n),"oz","g"),3)} g`)
    .replace(/(\d+(?:\.\d+)?)\s*lb\b/gi,(_,n)=>`${n} lb / ${formatKitchenNumber(exactConvert(Number(n),"lb","kg"),3)} kg`);
}

export interface IngredientDensity{id:string;name:string;aliases:string[];gramsPerUsCup:number|null;approximate:true;sourceNote:string}
export const ingredientDensities:IngredientDensity[]=["All-purpose flour","Bread flour","Cake flour","Granulated sugar","Brown sugar","Powdered sugar","Honey","Butter","Milk","Water","Rice","Salt","Cooking oil"].map((name,index)=>({id:`ingredient-${index+1}`,name,aliases:[],gramsPerUsCup:null,approximate:true,sourceNote:"待可靠来源确认；当前不启用 cup 与 gram 换算。"}));
