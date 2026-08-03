import {beforeEach,describe,expect,it,vi} from "vitest";

const {createClient,signInWithPassword}=vi.hoisted(()=>{
  const signInWithPassword=vi.fn(async()=>({error:{message:"Invalid login credentials"}}));
  return {createClient:vi.fn(()=>({auth:{signInWithPassword}})),signInWithPassword};
});
vi.mock("@supabase/supabase-js",()=>({createClient}));

import {signInWithPassword as appSignInWithPassword} from "../src/services/supabase";

describe("Supabase auth",()=>{
  beforeEach(()=>{
    signInWithPassword.mockClear();
    vi.stubEnv("VITE_SUPABASE_URL","https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY","publishable");
    vi.stubGlobal("window",{
      localStorage:{removeItem:vi.fn(),key:vi.fn(()=>null),length:0}
    });
  });

  it("maps invalid credentials to a clear recovery hint",async()=>{
    await expect(appSignInWithPassword("owner@example.test","wrong-pass")).rejects.toThrow("若该账号未设置密码");
  });
});
