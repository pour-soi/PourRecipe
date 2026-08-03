import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";

const migration=new URL("../supabase/migrations/202607280001_initial.sql",import.meta.url);
describe("Supabase migration contract",()=>{
  it("creates every required table and enables RLS",async()=>{const sql=await readFile(migration,"utf8");for(const table of ["profiles","recipes","recipe_ingredients","recipe_steps","categories","tags","recipe_categories","recipe_tags","cook_records","images","ocr_records","sync_changes"]){expect(sql).toContain(`create table if not exists public.${table}`);expect(sql).toContain(`'${table}'`)}expect(sql).toContain("enable row level security")});
  it("derives ownership from auth.uid and protects related rows",async()=>{const sql=await readFile(migration,"utf8");expect(sql).toContain("user_id=auth.uid()");expect(sql).toContain("r.id=recipe_id and r.user_id=auth.uid()");expect(sql).toContain("i.id=image_id and i.recipe_id=recipe_id");expect(sql).toContain("cur.revision<>base")});
  it("creates a private size- and MIME-limited bucket",async()=>{const sql=await readFile(migration,"utf8");expect(sql).toContain("values('pourrecipe-images','pourrecipe-images',false,12582912");expect(sql).toContain("array['image/jpeg','image/png','image/webp']");expect(sql).toContain("(storage.foldername(name))[1]=auth.uid()::text")});
  it("records AI usage without exposing it across users",async()=>{const sql=await readFile(new URL("../supabase/migrations/202607300001_ai_usage.sql",import.meta.url),"utf8");expect(sql).toContain("create table if not exists public.ai_usage");expect(sql).toContain("enable row level security");expect(sql).toContain("user_id=auth.uid()");expect(sql).toContain("own_ai_usage_insert")});
});
