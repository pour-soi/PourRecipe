import type {ParserDetectedType,ParserLine,Recipe,RecipeParserResult} from "../data/types";
import {enhanceUnits} from "../../lib/units";

const unitPattern=/(?:\d+(?:[.,]\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*(?:kg|g|ml|l|oz|lb|us\s+cups?|cups?|tbsp|tsp|克|千克|公斤|毫升|升|汤匙|茶匙|勺|个|片|块|包|罐)(?![A-Za-z])|(?:kg|g|ml|l|oz|lb|us\s+cups?|cups?|tbsp|tsp|克|千克|公斤|毫升|升|汤匙|茶匙|勺|个|片|块|包|罐)\s*(?:\d+(?:[.,]\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)/i;
const fractionPattern=/(?:^|\s)(?:\d+\s+)?\d+\/\d+(?:\s|$)|半(?:个|勺|杯|包|罐)?|一个|两勺/;
const vagueAmountPattern=/(?:适量|少许|一点|to taste)\s*$/i;
const stepPrefixPattern=/^(?:\d+\s*[.、)]|[①②③④⑤⑥⑦⑧⑨⑩]|第[一二三四五六七八九十\d]+步|step\s*\d+)/i;
const cookingVerbPattern=/(?:加入|放入|混合|搅拌|打发|腌制|预热|烤|煮|炖|蒸|炒|翻面|静置|冷藏|切|洗|倒入|盛出|\bbake\b|\bbroil\b|\bfry\b|\bair\s*fry\b|\bcook\b|\bmix\b|\bstir\b|\bchop\b|\bslice\b|\bpreheat\b)/i;
const timePattern=/(?:\d+(?:\.\d+)?)\s*(?:秒|分钟|小时|min(?:ute)?s?|hours?|hrs?)\b/i;
const temperaturePattern=/(?:\d+(?:\.\d+)?)\s*(?:℃|°\s*[CF]|degrees?\s*[CF]|度)/i;
const nonRecipePattern=/(?:https?:\/\/|www\.|@\w+|扫码|二维码|点赞|收藏|关注|评论|广告|subscribe|follow|like\s+and\s+share|营养成分|营养信息|nutrition facts?|首页|返回|导航)/i;
const headingPattern=/^(?:食材|材料|配料|ingredients?|步骤|做法|制作方法|directions?|instructions?|method)\s*[:：]?$/i;

const normalize=(line:string)=>line.normalize("NFKC").replace(/[ \t]+/g," ").trim();
const roundConfidence=(value:number)=>Math.round(Math.min(0.99,value)*100)/100;

function classifyLine(originalLine:string,index:number):ParserLine{
  const normalizedLine=normalize(originalLine),matchedRules:string[]=[];
  let detectedType:ParserDetectedType="unknown",confidence=.4;
  if(nonRecipePattern.test(normalizedLine)){matchedRules.push("non-recipe-content");confidence=.96}
  else if(headingPattern.test(normalizedLine)){matchedRules.push("section-heading");confidence=.65}
  else{
    let ingredientScore=0,stepScore=0;
    if(unitPattern.test(normalizedLine)){ingredientScore+=.82;matchedRules.push("quantity-unit")}
    if(fractionPattern.test(normalizedLine)){ingredientScore+=.58;matchedRules.push("fraction-or-count")}
    if(vagueAmountPattern.test(normalizedLine)){ingredientScore+=.76;matchedRules.push("vague-amount")}
    if(stepPrefixPattern.test(normalizedLine)){stepScore+=.72;matchedRules.push("step-prefix")}
    if(cookingVerbPattern.test(normalizedLine)){stepScore+=.7;matchedRules.push("cooking-verb")}
    if(cookingVerbPattern.test(normalizedLine)&&timePattern.test(normalizedLine)){stepScore+=.18;matchedRules.push("action-time")}
    if(cookingVerbPattern.test(normalizedLine)&&temperaturePattern.test(normalizedLine)){stepScore+=.2;matchedRules.push("action-temperature")}
    if(stepScore>=ingredientScore&&stepScore>=.68){detectedType="step";confidence=roundConfidence(stepScore)}
    else if(ingredientScore>.65){detectedType="ingredient";confidence=roundConfidence(ingredientScore)}
  }
  return{id:`line-${index}`,originalLine,normalizedLine,detectedType,confidence,matchedRules,sortOrder:index};
}

function rebuild(sourceLines:ParserLine[],parsedAt=new Date().toISOString()):RecipeParserResult{
  const sorted=[...sourceLines].sort((a,b)=>a.sortOrder-b.sortOrder);
  const suggestedTitle=sorted.find(line=>line.detectedType==="title")??null;
  return{
    suggestedTitle,
    ingredients:sorted.filter(line=>line.detectedType==="ingredient"),
    steps:sorted.filter(line=>line.detectedType==="step"),
    unknown:sorted.filter(line=>line.detectedType==="unknown"||line.detectedType==="ignored"),
    sourceLines:sorted,
    parsedAt
  };
}

export function parseRecipeText(text:string):RecipeParserResult{
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(classifyLine);
  const firstRecipeIndex=lines.findIndex(line=>line.detectedType==="ingredient"||line.detectedType==="step");
  const title=lines.find((line,index)=>index<Math.max(1,firstRecipeIndex)&&index<6&&line.detectedType==="unknown"&&line.normalizedLine.length<=40&&!unitPattern.test(line.normalizedLine)&&!stepPrefixPattern.test(line.normalizedLine)&&!timePattern.test(line.normalizedLine)&&!temperaturePattern.test(line.normalizedLine)&&!nonRecipePattern.test(line.normalizedLine));
  if(title&&firstRecipeIndex>title.sortOrder){
    title.detectedType="title";title.confidence=.78;title.matchedRules=[...title.matchedRules,"short-leading-text"];
  }
  return rebuild(lines);
}

export function updateParserLine(result:RecipeParserResult,id:string,changes:Partial<Pick<ParserLine,"normalizedLine"|"detectedType">>):RecipeParserResult{
  const next=result.sourceLines.map(line=>{
    if(changes.detectedType==="title"&&line.detectedType==="title"&&line.id!==id)return{...line,detectedType:"unknown" as const,confidence:.4,matchedRules:["manual-reclassification"]};
    if(line.id!==id)return line;
    return{...line,...changes,confidence:1,matchedRules:["manual-reclassification"]};
  });
  return rebuild(next,new Date().toISOString());
}

export function moveParserLine(result:RecipeParserResult,id:string,direction:-1|1):RecipeParserResult{
  const current=result.sourceLines.find(line=>line.id===id);if(!current)return result;
  const group=result.sourceLines.filter(line=>line.detectedType===current.detectedType).sort((a,b)=>a.sortOrder-b.sortOrder);
  const index=group.findIndex(line=>line.id===id),target=group[index+direction];if(!target)return result;
  const next=result.sourceLines.map(line=>line.id===current.id?{...line,sortOrder:target.sortOrder}:line.id===target.id?{...line,sortOrder:current.sortOrder}:line);
  return rebuild(next,new Date().toISOString());
}

export function toConfirmedRecipeFields(result:RecipeParserResult){
  return{
    title:result.suggestedTitle?.normalizedLine.trim()??"",
    ingredients:result.ingredients.map(line=>line.normalizedLine.trim()).filter(Boolean).map(originalText=>({originalText,normalizedText:enhanceUnits(originalText)})),
    steps:result.steps.map(line=>line.normalizedLine.trim()).filter(Boolean).map(originalText=>({originalText,normalizedText:enhanceUnits(originalText)}))
  };
}

export function appendConfirmedParserResult(recipe:Recipe,result:RecipeParserResult,useTitle:boolean,makeId:()=>string):Recipe{
  const fields=toConfirmedRecipeFields(result);
  return{
    ...recipe,
    name:useTitle&&fields.title?fields.title:recipe.name,
    ingredients:[...recipe.ingredients,...fields.ingredients.map((item,index)=>({id:makeId(),...item,sortOrder:recipe.ingredients.length+index}))],
    steps:[...recipe.steps,...fields.steps.map((item,index)=>({id:makeId(),...item,sortOrder:recipe.steps.length+index}))]
  };
}
