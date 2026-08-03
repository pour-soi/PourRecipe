import {beforeEach,describe,expect,it,vi} from "vitest";

const {createClient,signInWithOtp,onAuthStateChange,unsubscribe,getSession,setSession}=vi.hoisted(()=>{
  const signInWithOtp=vi.fn(async()=>({error:null}));
  const unsubscribe=vi.fn();
  const onAuthStateChange=vi.fn(()=>({data:{subscription:{unsubscribe}}}));
  const getSession=vi.fn(async()=>({data:{session:null},error:null}));
  const setSession=vi.fn(async()=>({data:{session:{user:{email:"owner@example.test"}}},error:null}));
  return{createClient:vi.fn(()=>({auth:{signInWithOtp,onAuthStateChange,getSession,setSession}})),signInWithOtp,onAuthStateChange,unsubscribe,getSession,setSession};
});
vi.mock("@supabase/supabase-js",()=>({createClient}));

import {initializeAuthSession,requestEmailMagicLink} from "../src/services/supabase";

describe("Email Magic Link",()=>{
  beforeEach(()=>{
    signInWithOtp.mockClear();
    vi.stubEnv("VITE_SUPABASE_URL","https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY","publishable");
    vi.stubGlobal("window",{location:{origin:"https://staging.example",hash:""}});
    vi.stubGlobal("location",{pathname:"/",search:""});
    vi.stubGlobal("history",{replaceState:vi.fn()});
  });

  it("uses the current allowed origin and never creates a new user",async()=>{
    await requestEmailMagicLink("owner@example.test");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email:"owner@example.test",
      options:{shouldCreateUser:false,emailRedirectTo:"https://staging.example"}
    });
    expect(createClient).toHaveBeenCalledWith("https://project.supabase.co","publishable",{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"implicit"}
    });
  });

  it("restores an existing session and keeps listening for changes",async()=>{
    const callback=vi.fn();
    const stop=await initializeAuthSession(callback);
    expect(onAuthStateChange).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({authenticated:false});
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("claims the implicit Magic Link session and removes tokens from the URL",async()=>{
    window.location.hash="#access_token=access-value&refresh_token=refresh-value&type=magiclink";
    const callback=vi.fn();
    const stop=await initializeAuthSession(callback);
    expect(setSession).toHaveBeenCalledWith({access_token:"access-value",refresh_token:"refresh-value"});
    expect(history.replaceState).toHaveBeenCalledWith(null,"","/");
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({authenticated:true,email:"owner@example.test"}));
    stop();
  });
});
