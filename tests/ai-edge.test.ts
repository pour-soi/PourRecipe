import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";

const source=new URL("../supabase/functions/recipe-structure/index.ts",import.meta.url);

describe("recipe structure Edge Function",()=>{
  it("uses authenticated Responses API Structured Outputs",async()=>{const code=await readFile(source,"utf8");expect(code).toContain('https://api.openai.com/v1/responses');expect(code).toContain('type:"json_schema"');expect(code).toContain("strict:true");expect(code).toContain("supabase.auth.getUser()");expect(code).not.toContain("api.openai.com/v1/assistants")});
  it("sends only confirmed OCR text and limits request data",async()=>{const code=await readFile(source,"utf8");expect(code).toContain("text.length>50000");expect(code).not.toContain("imageDataUrl");expect(code).not.toContain('type:"input_image"');expect(code).toContain('Deno.env.get("OPENAI_API_KEY")')});
  it("requires nullable Celsius and Fahrenheit fields without inventing values",async()=>{const code=await readFile(source,"utf8");expect(code).toContain('temperatureF:{type:["number","null"]}');expect(code).toContain('use null for absent numeric values');expect(code).toContain("KitchenAid");expect(code).toContain("Instant Pot")});
  it("has bounded timeout and safe invalid-output errors",async()=>{const code=await readFile(source,"utf8");expect(code).toContain("new AbortController()");expect(code).toContain("45000");expect(code).toContain("智能整理超时");expect(code).toContain("智能整理结果无效")});
  it("allows the local production-preview origin used for real UI verification",async()=>{const code=await readFile(source,"utf8");expect(code).toContain("http://127.0.0.1:4176")});
});
