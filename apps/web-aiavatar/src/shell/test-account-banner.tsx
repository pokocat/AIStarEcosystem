"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {getAuthToken} from "@ai-star-eco/api-client";
export function TestAccountBanner(){
 const pathname=usePathname(),[test,setTest]=useState(false);
 useEffect(()=>{try{const raw=getAuthToken()?.split(".")[1];const claims=raw?JSON.parse(atob(raw.replace(/-/g,"+").replace(/_/g,"/"))):{};setTest(claims.test_account===true);}catch{setTest(false);}},[pathname]);
 return test?<aside role="status" style={{position:"fixed",bottom:12,left:12,zIndex:10000,background:"#f2e6bc",color:"#302a18",border:"1px solid #c7b678",borderRadius:8,padding:"8px 12px",fontSize:13,boxShadow:"0 3px 10px #19222914"}}>测试账号 · 企业权限、开通和积分按正常规则检查</aside>:null;
}
