import "fake-indexeddb/auto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {db,now,uid} from "../src/data/db";
import {createTaxonomy,queue,restoreRecipe,saveRecipe,softDeleteRecipe} from "../src/data/operations";
import {beginSync,resolveConflict,syncNow} from "../src/services/sync";
import type {Recipe} from "../src/data/types";

const recipe=(id=uid(),name="本机食谱"):Recipe=>({id,name,description:"",status:"untried",ingredients:[],steps:[],categoryIds:[],tagIds:[],sourceType:"manual",sourceUrl:"",rawText:"",normalizedText:"",coverImageId:null,createdAt:now(),updatedAt:now(),deletedAt:null,syncStatus:"local_only",revision:0});
beforeEach(async()=>{db.close();await db.delete();await db.open()});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});

describe("local-first queue",()=>{
  it("compresses repeated edits and keeps the original base revision",async()=>{const value=recipe();await saveRecipe(value);await saveRecipe({...value,name:"第二次修改",revision:7});expect(await db.syncQueue.count()).toBe(1);expect(await db.syncQueue.get(`recipe:${value.id}`)).toMatchObject({baseRevision:0})});
  it("compresses delete and restore into a restore task",async()=>{const value=recipe();await db.recipes.add(value);await softDeleteRecipe(value.id);await restoreRecipe(value.id);expect(await db.syncQueue.get(`recipe:${value.id}`)).toMatchObject({action:"restore"})});
  it("keeps local data when Supabase is unavailable",async()=>{const value=recipe();await saveRecipe(value);await expect(syncNow()).rejects.toThrow("Supabase");expect(await db.recipes.get(value.id)).toMatchObject({name:"本机食谱"});expect(await db.syncQueue.count()).toBe(1)});
  it("queues taxonomy changes with stable UUIDs",async()=>{const category=await createTaxonomy("categories","早餐");expect(await db.syncQueue.get(`category:${category.id}`)).toMatchObject({objectType:"category"})});
  it("requires a local backup confirmation before cloud replacement",async()=>{await expect(beginSync("download","hidden@example.test")).rejects.toThrow("ZIP")});
});

describe("conflict choices",()=>{
  it("keeps local data and rebases the pending task",async()=>{const value=recipe();await saveRecipe(value);await db.syncConflicts.put({id:`recipe:${value.id}`,objectId:value.id,objectType:"recipe",localData:JSON.stringify(value),remoteData:JSON.stringify({...value,name:"云端"}),remoteRevision:4,createdAt:now()});await resolveConflict(`recipe:${value.id}`,"local");expect(await db.syncQueue.get(`recipe:${value.id}`)).toMatchObject({baseRevision:4});expect((await db.recipes.get(value.id))?.name).toBe("本机食谱")});
  it("uses remote data only after explicit choice",async()=>{const value=recipe();await saveRecipe(value);await db.syncConflicts.put({id:`recipe:${value.id}`,objectId:value.id,objectType:"recipe",localData:JSON.stringify(value),remoteData:JSON.stringify({...value,name:"云端"}),remoteRevision:4,createdAt:now()});await resolveConflict(`recipe:${value.id}`,"remote");expect(await db.recipes.get(value.id)).toMatchObject({name:"云端",revision:4,syncStatus:"synced"})});
});
