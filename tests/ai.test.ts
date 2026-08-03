import {describe,expect,it} from "vitest";
import type {AiRecipeDraft,Recipe} from "../src/data/types";
import {applyAiDraft,parseAiDraft} from "../src/services/ai";

const recipe:Recipe={id:"r",name:"已有名称",status:"untried",description:"",ingredients:[],steps:[],categoryIds:[],tagIds:[],sourceType:"manual",sourceUrl:"",rawText:"raw",normalizedText:"",coverImageId:null,createdAt:"",updatedAt:"",deletedAt:null,syncStatus:"local_only",revision:0};
const draft:AiRecipeDraft={suggestedTitle:"Apple Pie",ingredients:[{originalText:"flour 500 g",name:"flour",quantity:500,unit:"g",note:"",confidence:.9},{originalText:"salt 少许",name:"salt",quantity:null,unit:null,note:"少许",confidence:.7}],steps:[{originalText:"bake at 180℃ for 20 min",temperatureC:180,temperatureF:356,durationMinutes:20,confidence:.9}],otherText:["@author"],warnings:["salt quantity uncertain"]};

describe("AI recipe draft",()=>{
  it("does not change a recipe until explicitly applied",()=>{expect(recipe).toMatchObject({name:"已有名称",ingredients:[],steps:[]})});
  it("applies only selected items and keeps English source text",()=>{let n=0;const result=applyAiDraft(recipe,draft,{title:false,ingredients:[true,false],steps:[true]},()=>`id-${++n}`);expect(result.name).toBe("已有名称");expect(result.ingredients).toHaveLength(1);expect(result.ingredients[0].originalText).toBe("flour 500 g");expect(result.steps[0].originalText).toContain("bake");expect(result.steps[0].normalizedText).toContain("356°F")});
  it("preserves Chinese, English, and brand terms without filling missing values",()=>{const mixed:AiRecipeDraft={suggestedTitle:"Ninja 空气炸锅",ingredients:[{originalText:"cream cheese 适量",name:"cream cheese",quantity:null,unit:null,note:"适量",confidence:.6}],steps:[{originalText:"air fryer 后 flip，再 broil",temperatureC:null,temperatureF:null,durationMinutes:null,confidence:.5}],otherText:["KitchenAid / Instant Pot"],warnings:["时间不确定"]};expect(parseAiDraft(mixed)).toEqual(mixed)});
  it("rejects an invalid structured response",()=>{expect(()=>parseAiDraft({...draft,steps:[{originalText:"bake"}]})).toThrow("结果无效")});
});
