import {beforeEach,describe,expect,it} from "vitest";
import {approximateFraction,butterEquivalents,convertRecipeText,equivalents,exactConvert,ingredientDensities,KITCHEN_CONSTANTS,type Unit,unitsByCategory} from "../lib/kitchen-tools";
import {addFavoriteConversion,addRecentConversion,clearSavedConversions,deleteSavedConversion,getFavoriteConversions,getRecentConversions} from "../src/services/kitchen-history";

class MemoryStorage{data=new Map<string,string>();getItem(key:string){return this.data.get(key)??null}setItem(key:string,value:string){this.data.set(key,value)}removeItem(key:string){this.data.delete(key)}clear(){this.data.clear()}}
beforeEach(()=>Object.defineProperty(globalThis,"localStorage",{value:new MemoryStorage(),configurable:true}));

describe("kitchen conversion precision",()=>{
  it("converts temperature both ways including negative values and zero",()=>{expect(exactConvert(180,"°C","°F")).toBe(356);expect(exactConvert(350,"°F","°C")).toBeCloseTo(176.6666667);expect(exactConvert(-40,"°C","°F")).toBe(-40);expect(exactConvert(0,"°C","°F")).toBe(32)});
  it("supports every declared weight, US volume, and length unit",()=>{for(const units of [unitsByCategory.weight,unitsByCategory.volume,unitsByCategory.length])for(const from of units)for(const to of units)expect(exactConvert(exactConvert(123.456,from as Unit,to as Unit),to as Unit,from as Unit)).toBeCloseTo(123.456,8)});
  it("keeps weight ounces distinct from US fluid ounces",()=>{expect(exactConvert(1,"oz","g")).toBeCloseTo(KITCHEN_CONSTANTS.ozG);expect(exactConvert(1,"US fl oz","ml")).toBeCloseTo(KITCHEN_CONSTANTS.usFlOzMl);expect(()=>exactConvert(1,"oz","US fl oz")).toThrow("不兼容")});
  it("returns the requested multi-value examples",()=>{const weight=equivalents(500,"g"),volume=equivalents(250,"ml");expect(weight.find(item=>item.unit==="oz")?.value).toBeCloseTo(17.63698);expect(weight.find(item=>item.unit==="lb")?.value).toBeCloseTo(1.10231);expect(volume.find(item=>item.unit==="US cup")?.value).toBeCloseTo(1.05669);expect(volume.find(item=>item.unit==="US tbsp")?.value).toBeCloseTo(16.907)});
  it("handles huge finite values and rejects incompatible units",()=>{expect(Number.isFinite(exactConvert(1e200,"kg","lb"))).toBe(true);expect(()=>exactConvert(1,"cm","g")).toThrow()});
});

describe("fractions, butter, and recipe text",()=>{
  it("only suggests close common fractions",()=>{expect(approximateFraction(.5)).toBe("1/2");expect(approximateFraction(1.333)).toBe("1 1/3");expect(approximateFraction(.6)).toBeNull()});
  it("supports fractional butter sticks",()=>{expect(butterEquivalents(.5)).toMatchObject({ounces:2,tablespoons:4});expect(butterEquivalents(1).grams).toBeCloseTo(113.398)});
  it("adds US equivalents to Chinese while preserving all other wording",()=>{const source="500克牛肉\n250毫升水\n180℃\n小火慢煮";const result=convertRecipeText(source,"cn-us");expect(source).toBe("500克牛肉\n250毫升水\n180℃\n小火慢煮");expect(result).toContain("500 g / 17.6 oz 牛肉");expect(result).toContain("250 ml / 8.45 US fl oz 水");expect(result).toContain("180℃ / 356°F");expect(result).toContain("小火慢煮")});
  it("standardizes US recipe units without inventing cup-to-gram values",()=>{const result=convertRecipeText("2 cups flour\n1 tbsp sugar\n350°F","us-cn");expect(result).toContain("2 US cups flour");expect(result).toContain("1 US tbsp sugar");expect(result).toContain("350°F / 176.7℃");expect(result).not.toMatch(/flour.*g/)});
  it("keeps ingredient density entries disabled until sourced",()=>{expect(ingredientDensities).toHaveLength(13);expect(ingredientDensities.every(item=>item.approximate&&item.gramsPerUsCup===null&&item.sourceNote)).toBe(true)});
});

describe("local recent conversions and favorites",()=>{
  const item={id:"one",category:"temperature" as const,input:"180 °C",output:"180 °C = 356 °F",createdAt:"2026-08-03T00:00:00Z"};
  it("stores, reuses, deletes, and clears without a remote dependency",()=>{addRecentConversion(item);expect(getRecentConversions()).toEqual([item]);addFavoriteConversion(item);expect(getFavoriteConversions()).toEqual([item]);expect(deleteSavedConversion("recent",item.id)).toEqual([]);expect(clearSavedConversions("favorite")).toEqual([])});
  it("deduplicates repeated conversions",()=>{addRecentConversion(item);addRecentConversion({...item,id:"two"});expect(getRecentConversions()).toHaveLength(1)});
});
