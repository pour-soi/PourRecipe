import {describe,expect,it} from "vitest";
import {appendConfirmedParserResult,moveParserLine,parseRecipeText,toConfirmedRecipeFields,updateParserLine} from "../src/services/recipe-parser";
import type {Recipe} from "../src/data/types";

describe("rule-based recipe parser",()=>{
  it("classifies a Chinese recipe without treating every line as one type",()=>{
    const result=parseRecipeText("空气炸鸡腿\n鸡腿 500 g\n盐 少许\n1、鸡腿洗净并腌制 20 分钟\n2、预热至 180℃，烤 20 分钟\n关注 @someone");
    expect(result.suggestedTitle?.normalizedLine).toBe("空气炸鸡腿");
    expect(result.ingredients.map(x=>x.normalizedLine)).toEqual(["鸡腿 500 g","盐 少许"]);
    expect(result.steps).toHaveLength(2);
    expect(result.unknown.map(x=>x.normalizedLine)).toContain("关注 @someone");
    expect(result.ingredients.every(x=>x.matchedRules.length>0)).toBe(true);
  });

  it("supports English and mixed ingredient units",()=>{
    const result=parseRecipeText("Soy Chicken\n2 tbsp soy sauce\n鸡腿 1 1/2 kg\nsalt to taste\nStep 1 Mix everything\nbake at 350°F for 20 minutes");
    expect(result.ingredients.map(x=>x.normalizedLine)).toEqual(["2 tbsp soy sauce","鸡腿 1 1/2 kg","salt to taste"]);
    expect(result.steps).toHaveLength(2);
  });

  it("does not classify arbitrary numbers, URLs, accounts or vague text as ingredients",()=>{
    const result=parseRecipeText("Recipe 2026\nhttps://example.com\n@example\n第 3 页\n口感很好");
    expect(result.ingredients).toHaveLength(0);
    expect(result.steps).toHaveLength(0);
    expect(result.unknown).toHaveLength(5);
  });

  it("requires a cooking action before time or temperature makes a step",()=>{
    const result=parseRecipeText("营养信息 200 kcal\n180℃\n静置 10 min\ncook 15 minutes");
    expect(result.steps.map(x=>x.normalizedLine)).toEqual(["静置 10 min","cook 15 minutes"]);
    expect(result.unknown.map(x=>x.normalizedLine)).toEqual(expect.arrayContaining(["营养信息 200 kcal","180°C"]));
  });

  it("preserves source text while allowing manual reclassification, editing and ordering",()=>{
    const original="Quick Soup\nwater\nBoil 10 minutes";
    const parsed=parseRecipeText(original);
    const water=parsed.unknown.find(x=>x.normalizedLine==="water")!;
    const moved=updateParserLine(parsed,water.id,{detectedType:"ingredient",normalizedLine:"water 250 ml"});
    expect(moved.ingredients.map(x=>x.normalizedLine)).toContain("water 250 ml");
    expect(moved.sourceLines.find(x=>x.id===water.id)?.originalLine).toBe("water");
    const reordered=moveParserLine(moved,water.id,-1);
    expect(reordered.ingredients.map(x=>x.normalizedLine)).toContain("water 250 ml");
    expect(reordered.unknown.map(x=>x.id)).not.toContain(water.id);
    expect(original).toBe("Quick Soup\nwater\nBoil 10 minutes");
  });

  it("enhances units only when producing confirmed recipe fields",()=>{
    const parsed=parseRecipeText("Roast\nchicken 500 g\nbake at 180℃");
    expect(parsed.ingredients[0].normalizedLine).toBe("chicken 500 g");
    const confirmed=toConfirmedRecipeFields(parsed);
    expect(confirmed.ingredients[0]).toEqual({originalText:"chicken 500 g",normalizedText:expect.stringContaining("17.6 oz")});
    expect(confirmed.steps[0]).toEqual({originalText:"bake at 180°C",normalizedText:expect.stringContaining("356°F")});
  });

  it("appends confirmed fields without overwriting existing recipe content or raw text",()=>{
    const recipe:Recipe={id:"recipe",name:"已有名称",status:"untried",description:"",ingredients:[{id:"old-i",originalText:"旧食材",normalizedText:"旧食材",sortOrder:0}],steps:[{id:"old-s",originalText:"旧步骤",normalizedText:"旧步骤",sortOrder:0}],categoryIds:[],tagIds:[],sourceType:"manual",sourceUrl:"",rawText:"必须保留的原文",normalizedText:"",coverImageId:null,createdAt:"",updatedAt:"",deletedAt:null,syncStatus:"local_only",revision:0};
    let id=0;const parsed=parseRecipeText("新标题\nflour 500 g\n1. Mix and bake at 180℃");
    const next=appendConfirmedParserResult(recipe,parsed,false,()=>`new-${++id}`);
    expect(next.name).toBe("已有名称");
    expect(next.rawText).toBe("必须保留的原文");
    expect(next.ingredients.map(x=>x.originalText)).toEqual(["旧食材","flour 500 g"]);
    expect(next.steps.map(x=>x.originalText)).toEqual(["旧步骤","1. Mix and bake at 180°C"]);
  });
});
