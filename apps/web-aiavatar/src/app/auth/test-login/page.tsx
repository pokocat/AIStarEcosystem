"use client";
import {useEffect,useRef,useState} from "react";
import {beginLogin,clearAuthTokens} from "@ai-star-eco/api-client";
import {isImpersonating} from "@ai-star-eco/api-client/impersonation-session";
export default function TestLoginPage(){
 const started=useRef(false),[error,setError]=useState("");
 useEffect(()=>{if(started.current)return;started.current=true;
  if(isImpersonating()){setError("请先退出运营查看，再进入测试账号。");return;}
  clearAuthTokens();void beginLogin("/enterprise").catch(()=>setError("测试登录未完成，请返回后台重新生成入口。"));
 },[]);
 return <main style={{maxWidth:440,margin:"15vh auto",padding:24}}><h1>进入测试账号</h1><p role="status">{error||"正在通过账号中心完成登录…"}</p>{error&&<a href="/login">返回登录</a>}</main>;
}
