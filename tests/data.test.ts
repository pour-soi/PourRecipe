import "fake-indexeddb/auto";
import {beforeEach,describe,expect,it} from "vitest";
import {db,now,uid} from "../src/data/db";
import {addCookRecord,createTaxonomy,deleteImage,deleteTaxonomy,duplicateTags,getOrCreateOcrRecord,mergeTaxonomy,permanentlyDeleteRecipe,renameTaxonomy,restoreRecipe,saveImage,softDeleteRecipe,swapCategoryOrder} from "../src/data/operations";
import type {Recipe,StoredImage} from "../src/data/types";
import {changeImageType,reorderImages,saveImageNote} from "../src/services/image-management";
import {enhanceUnits,mlToUsFlOz} from "../lib/units";

const recipe=(id=uid()):Recipe=>({id,name:"测试食谱",description:"",status:"untried",ingredients:[],steps:[],categoryIds:[],tagIds:[],sourceType:"manual",sourceUrl:"",rawText:"air fryer 180℃",normalizedText:"air fryer 180℃ / 356°F",coverImageId:null,createdAt:now(),updatedAt:now(),deletedAt:null,syncStatus:"local_only",revision:0});
const image=(recipeId:string,type:StoredImage["type"]="cover"):StoredImage=>({id:uid(),recipeId,cookRecordId:null,stepId:null,type,blob:new Blob(["full"],{type:"image/jpeg"}),mimeType:"image/jpeg",width:1,height:1,thumbnailBlob:new Blob(["thumb"],{type:"image/jpeg"}),note:"",sortOrder:0,createdAt:now(),updatedAt:now(),syncStatus:"local_only"});
beforeEach(async()=>{db.close();await db.delete();await db.open()});

describe("taxonomy safety",()=>{
  it("deleting a category only removes the relation",async()=>{const c=await createTaxonomy("categories","晚餐"),r={...recipe(),categoryIds:[c.id]};await db.recipes.add(r);await deleteTaxonomy("categories",c.id);expect(await db.recipes.get(r.id)).toMatchObject({categoryIds:[]})});
  it("merges without duplicate relations",async()=>{const a=await createTaxonomy("categories","A"),b=await createTaxonomy("categories","B"),r={...recipe(),categoryIds:[a.id,b.id]};await db.recipes.add(r);await mergeTaxonomy("categories",a.id,b.id);expect((await db.recipes.get(r.id))?.categoryIds).toEqual([b.id])});
  it("detects normalized duplicate tags",async()=>{await createTaxonomy("tags","Air Fryer");expect(await duplicateTags("air-fryer")).toHaveLength(1)});
  it("renames and reorders categories through the existing sync queue",async()=>{const first=await createTaxonomy("categories","早餐"),second=await createTaxonomy("categories","晚餐");await renameTaxonomy("categories",first.id,"早午餐");await swapCategoryOrder(first.id,second.id);expect(await db.categories.get(first.id)).toMatchObject({name:"早午餐",sortOrder:1,syncStatus:"pending"});expect(await db.categories.get(second.id)).toMatchObject({sortOrder:0,syncStatus:"pending"});expect(await db.syncQueue.where("objectType").equals("category").count()).toBe(2)});
});

describe("local deletion invariants",()=>{
  it("marks the first cook record as tried",async()=>{const r=recipe();await db.recipes.add(r);await addCookRecord({recipeId:r.id,cookedAt:"2026-01-01",actualTemperatureC:null,actualTemperatureF:null,actualDurationMinutes:null,actualServings:"",ingredientChanges:"",stepChanges:"",notes:"",isBestVersion:false,coverImageId:null});expect((await db.recipes.get(r.id))?.status).toBe("tried")});
  it("soft deletes and restores OCR with the recipe",async()=>{const r=recipe(),source=image(r.id,"source");await db.recipes.add(r);await saveImage(source);const ocr=await getOrCreateOcrRecord(r.id,source.id);await softDeleteRecipe(r.id);expect((await db.ocrRecords.get(ocr.id))?.deletedAt).toBeTruthy();await restoreRecipe(r.id);expect((await db.ocrRecords.get(ocr.id))?.deletedAt).toBeNull()});
  it("permanent deletion clears recipe, images, records and OCR",async()=>{const r=recipe(),source=image(r.id,"source");await db.recipes.add(r);await saveImage(source);const ocr=await getOrCreateOcrRecord(r.id,source.id);await permanentlyDeleteRecipe(r.id);expect(await Promise.all([db.recipes.get(r.id),db.images.get(source.id),db.ocrRecords.get(ocr.id)])).toEqual([undefined,undefined,undefined])});
  it("deleting a screenshot preserves tombstones for image and OCR sync",async()=>{const r=recipe(),source=image(r.id,"source");await db.recipes.add(r);await saveImage(source);const ocr=await getOrCreateOcrRecord(r.id,source.id);await deleteImage(source.id);expect(await db.images.get(source.id)).toMatchObject({syncStatus:"pending"});expect(await db.ocrRecords.get(ocr.id)).toMatchObject({syncStatus:"pending"})});
});

describe("unified image management",()=>{
  it("changes type without changing the image id and creates OCR traceability for screenshots",async()=>{const r=recipe(),stored=image(r.id,"cover");await db.recipes.add(r);await saveImage(stored);const changed=await changeImageType(stored,"source");expect(changed).toMatchObject({id:stored.id,type:"source"});expect(await db.ocrRecords.where("imageId").equals(stored.id).count()).toBe(1)});
  it("persists notes and reorders existing images through the sync queue",async()=>{const r=recipe(),first={...image(r.id),sortOrder:0},second={...image(r.id,"ingredient"),sortOrder:1};await db.recipes.add(r);await saveImage(first);await saveImage(second);await saveImageNote(first,"切面图");await reorderImages([first,second],1,-1);expect(await db.images.get(first.id)).toMatchObject({note:"切面图",sortOrder:1,syncStatus:"pending"});expect(await db.images.get(second.id)).toMatchObject({sortOrder:0,syncStatus:"pending"});expect(await db.syncQueue.where("objectType").equals("image").count()).toBe(2)});
});

describe("deterministic conversions",()=>{
  it("keeps raw text separate and converts cooking units once",()=>{const r=recipe();expect(r.rawText).toBe("air fryer 180℃");expect(enhanceUnits("60 ml")).toContain("US fl oz");expect(enhanceUnits("100 g / 3.5 oz")).toBe("100 g / 3.5 oz");expect(mlToUsFlOz(29.5735)).toBeCloseTo(1)});
  it("does not treat arbitrary degrees as temperature",()=>{expect(enhanceUnits("旋转 180 度")).toBe("旋转 180 度");expect(enhanceUnits("预热至 180 度")).toContain("356°F")});
});
