import "fake-indexeddb/auto";
import {beforeEach,describe,expect,it,vi} from "vitest";

const rpc=vi.fn(),upload=vi.fn(async(_path:string,_blob:Blob,_options?:unknown)=>({error:null})),download=vi.fn(),remove=vi.fn(async()=>({error:null}));
const client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:"11111111-1111-4111-8111-111111111111",email:"owner@example.test"}}},error:null}))},rpc,storage:{from:vi.fn(()=>({upload,download,remove}))}};
vi.mock("../src/services/supabase",()=>({isSupabaseConfigured:()=>true,getSupabase:()=>client}));

import {db,now,uid} from "../src/data/db";
import {saveImage,saveRecipe} from "../src/data/operations";
import {syncNow} from "../src/services/sync";
import type {Recipe,StoredImage} from "../src/data/types";

const recipe=():Recipe=>({id:uid(),name:"本机",status:"untried",description:"",ingredients:[],steps:[],categoryIds:[],tagIds:[],sourceType:"manual",sourceUrl:"",rawText:"",normalizedText:"",coverImageId:null,createdAt:now(),updatedAt:now(),deletedAt:null,syncStatus:"local_only",revision:0});
beforeEach(async()=>{db.close();await db.delete();await db.open();rpc.mockReset();upload.mockClear()});

describe("SupabaseSyncProvider",()=>{
  it("pushes local metadata and idempotent private image paths",async()=>{rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>name==="pull_sync_changes"?{data:[],error:null}:{data:{id:(args.p_change as {id:string}).id,objectType:(args.p_change as {objectType:string}).objectType,status:"synced",serverRevision:1},error:null});const r=recipe(),image:StoredImage={id:uid(),recipeId:r.id,cookRecordId:null,stepId:null,type:"cover",blob:new Blob(["full"],{type:"image/jpeg"}),thumbnailBlob:new Blob(["thumb"],{type:"image/jpeg"}),mimeType:"image/jpeg",width:1,height:1,note:"",sortOrder:0,createdAt:now(),updatedAt:now(),syncStatus:"local_only"};await saveRecipe(r);await saveImage(image);expect(await syncNow()).toMatchObject({synced:2,errors:0,conflicts:0});expect(upload.mock.calls.map(call=>call[0])).toEqual([expect.stringMatching(/1111.*\/recipes\/.*\/full\.webp$/),expect.stringMatching(/1111.*\/recipes\/.*\/thumb\.webp$/)]);expect(await db.syncQueue.count()).toBe(0)});
  it("keeps both sides when the server rejects a stale revision",async()=>{const r=recipe();await saveRecipe(r);rpc.mockResolvedValue({data:{id:r.id,objectType:"recipe",status:"conflict",serverRevision:3,serverData:{...r,name:"云端"}},error:null});const result=await syncNow();expect(result.conflicts).toBe(1);expect(await db.syncConflicts.get(`recipe:${r.id}`)).toMatchObject({remoteRevision:3});expect((await db.recipes.get(r.id))?.name).toBe("本机")});
});
