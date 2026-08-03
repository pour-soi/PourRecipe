import {createClient,type SupabaseClient} from "@supabase/supabase-js";

let client:SupabaseClient|null=null;
export type AuthSessionState={authenticated:boolean;email?:string;requiresPasswordReset?:boolean};

export function isSupabaseConfigured(){
  return Boolean(import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function clearCachedAuthState(storage:Storage){
  if(!storage||typeof storage.removeItem!=="function") return;
  const keys=Array.from({length:storage.length},(_,index)=>storage.key(index)).filter(Boolean) as string[];
  for(const key of keys){
    if(key.startsWith("sb-")||key.includes("-auth-token")){
      storage.removeItem(key);
    }
  }
}

export function getSupabase(){
  if(!isSupabaseConfigured())throw new Error("Supabase 尚未配置；本机数据仍可正常使用");
  const authOptions={
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:false,
    flowType:"implicit",
    ...(typeof window!=="undefined" && window?.localStorage?{storage:window.localStorage}:{})
  };
  return client??=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:authOptions});
}

export async function signInWithPassword(email:string,password:string){
  const {error}=await getSupabase().auth.signInWithPassword({email,password});
  if(error){
    clearCachedAuthState(window.localStorage);
    if(error.message==="Invalid login credentials"||error.message==="Invalid user credentials"){
      throw new Error("邮箱或密码错误。若该账号未设置密码，请先点“忘记密码”设置。");
    }
    if(error.message==="Email not confirmed"||error.message==="Email not yet confirmed"){
      throw new Error("邮箱尚未确认，请先确认邮箱后再尝试密码登录，或改用邮箱登录链接。");
    }
    if(error.message==="Email logins are disabled"){
      throw new Error("当前项目未开启密码登录，请使用邮箱登录链接。");
    }
    throw new Error(error.message || "登录失败");
  }
}

export async function requestEmailMagicLink(email:string){
  const emailRedirectTo=window.location.origin;
  const {error}=await getSupabase().auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo}});
  if(error?.status===429)throw new Error("邮件发送次数已达每小时限制，请稍后再试");
  if(error)throw new Error("该邮箱无法使用登录链接");
}

export async function requestPasswordReset(email:string){
  const redirectTo=window.location.origin;
  const {error}=await getSupabase().auth.resetPasswordForEmail(email,{redirectTo});
  if(error)throw new Error("发送密码重置邮件失败");
}

export async function updatePassword(password:string){
  const {error}=await getSupabase().auth.updateUser({password});
  if(error)throw new Error("密码更新失败");
}

export async function signOut(){const {error}=await getSupabase().auth.signOut();if(error)throw new Error("退出登录失败")}

export async function initializeAuthSession(callback:(session:AuthSessionState)=>void){
  const supabase=getSupabase();
  const getRecoveryFromHash=()=>new URLSearchParams(window.location.hash.slice(1)).get("type")==="recovery";
  const notify=(sessionState:Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"])=>{
    callback(sessionState
      ?{authenticated:true,email:sessionState.user.email??"",requiresPasswordReset:getRecoveryFromHash()}
      :{authenticated:false}
    );
  };
  const resetAuthState=()=>{
    clearCachedAuthState(window.localStorage);
    callback({authenticated:false});
  };
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
    notify(session);
  });
  const params=new URLSearchParams(window.location.hash.slice(1));
  const accessToken=params.get("access_token"),refreshToken=params.get("refresh_token"),type=params.get("type");
  const requiresPasswordReset=type==="recovery";
  if(params.has("error")){
    history.replaceState(null,"",`${location.pathname}${location.search}`);
    subscription.unsubscribe();
    throw new Error("邮箱登录链接无效或已过期，请重新发送");
  }
  if(accessToken&&refreshToken){
    const {data,error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
    history.replaceState(null,"",`${location.pathname}${location.search}`);
    if(error||!data.session){
      subscription.unsubscribe();
      resetAuthState();
      throw new Error("邮箱登录链接无效或已过期，请重新发送");
    }
    callback({
      authenticated:true,
      email:data.session.user.email??"",
      requiresPasswordReset
    });
  }else{
    const {data,error}=await supabase.auth.getSession();
    if(error){
      subscription.unsubscribe();
      resetAuthState();
      throw new Error("无法恢复登录状态");
    }
    notify(data.session);
  }
  return()=>subscription.unsubscribe();
}
