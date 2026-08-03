import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

const parseOrigins=(value:string)=>value.split(",").map(item=>item.trim()).filter(Boolean);
const defaultAllowedOrigins=new Set(parseOrigins("http://localhost:4173,http://127.0.0.1:4173,http://localhost:4174,http://127.0.0.1:4174,http://localhost:4176,http://127.0.0.1:4176"));

const cors=(origin:string)=>({
  "Access-Control-Allow-Origin":origin,
  "Access-Control-Allow-Headers":"authorization, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin"
});
const configuredOrigins=parseOrigins(Deno.env.get("ALLOWED_ORIGINS")??"");
const allowedOrigins=new Set([...defaultAllowedOrigins,...configuredOrigins]);
const schema={
  type:"object",additionalProperties:false,
  properties:{
    suggestedTitle:{type:"string"},
    ingredients:{type:"array",items:{type:"object",additionalProperties:false,properties:{originalText:{type:"string"},name:{type:"string"},quantity:{type:["number","null"]},unit:{type:["string","null"]},note:{type:"string"},confidence:{type:"number",minimum:0,maximum:1}},required:["originalText","name","quantity","unit","note","confidence"]}},
    steps:{type:"array",items:{type:"object",additionalProperties:false,properties:{originalText:{type:"string"},temperatureC:{type:["number","null"]},temperatureF:{type:["number","null"]},durationMinutes:{type:["number","null"]},confidence:{type:"number",minimum:0,maximum:1}},required:["originalText","temperatureC","temperatureF","durationMinutes","confidence"]}},
    otherText:{type:"array",items:{type:"string"}},
    warnings:{type:"array",items:{type:"string"}}
  },
  required:["suggestedTitle","ingredients","steps","otherText","warnings"]
};

Deno.serve(async request=>{
  const origin=request.headers.get("origin")??"";
  const headers={"Content-Type":"application/json",...cors(allowedOrigins.has(origin)?origin:"https://forbidden.local")};
  if(request.method==="OPTIONS")return new Response(null,{status:allowedOrigins.has(origin)?204:403,headers});
  if(request.method!=="POST"||!allowedOrigins.has(origin))return new Response(JSON.stringify({error:"Request not allowed"}),{status:403,headers});
  const auth=request.headers.get("Authorization");
  if(!auth)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers});
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers});
  const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
  const {count}=await supabase.from("ai_usage").select("id",{count:"exact",head:true}).gte("created_at",monthStart.toISOString());
  const key=Deno.env.get("OPENAI_API_KEY");
  let body:{action?:string;text?:string};
  try{body=await request.json()}catch{return new Response(JSON.stringify({error:"Invalid request"}),{status:400,headers})}
  if(body.action==="status")return new Response(JSON.stringify({available:Boolean(key),monthCalls:count??0}),{headers});
  if(!key)return new Response(JSON.stringify({error:"智能整理尚未配置"}),{status:503,headers});
  const text=body.text?.trim()??"";
  if(!text||text.length>50000)return new Response(JSON.stringify({error:"OCR 文字为空或过长"}),{status:400,headers});
  const content:Array<Record<string,string>>=[{type:"input_text",text}];
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const openai=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({
      model:Deno.env.get("OPENAI_MODEL")??"gpt-5.4-nano",
      instructions:"Extract a recipe only from the user-confirmed OCR text. Preserve Chinese, English, and mixed-language text exactly. Never translate brand names or cooking terms, including air fryer, cream cheese, heavy cream, broil, bake, flip, fold, KitchenAid, Ninja, and Instant Pot. Never invent missing ingredients, steps, quantities, units, temperatures, or durations; use null for absent numeric values and put uncertain or unrelated content in warnings or otherText.",
      input:[{role:"user",content}],
      text:{format:{type:"json_schema",name:"recipe_structure",schema,strict:true}}
    })});
    const result=await openai.json();
    if(!openai.ok)return new Response(JSON.stringify({error:"OpenAI 当前不可用"}),{status:502,headers});
    const outputText=result.output?.flatMap((item:{content?:Array<{type:string;text?:string}>})=>item.content??[]).find((item:{type:string})=>item.type==="output_text")?.text;
    if(!outputText)throw new Error("missing output");
    const draft=JSON.parse(outputText);
    await supabase.from("ai_usage").insert({user_id:user.id,model:result.model??"unknown",request_id:result.id??null,input_tokens:result.usage?.input_tokens??null,output_tokens:result.usage?.output_tokens??null});
    return new Response(JSON.stringify({draft}),{headers});
  }catch(error){
    const message=error instanceof DOMException&&error.name==="AbortError"?"智能整理超时":"智能整理结果无效";
    return new Response(JSON.stringify({error:message}),{status:502,headers});
  }finally{clearTimeout(timeout)}
});
