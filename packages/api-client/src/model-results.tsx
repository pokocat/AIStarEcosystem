"use client";

import {useEffect,useState} from "react";
import {apiFetch} from "./_client";

type Summary={id:string;model:string;purpose:string;createdAt:string};
type Detail={id:string;content:string;finishReason:string};
/** Read-only recovery surface: model text is always rendered as text, never HTML or executable actions. */
export function ModelResults(){
  const [page,setPage]=useState(0),[rows,setRows]=useState<Summary[]>([]),[selected,setSelected]=useState<string|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[copied,setCopied]=useState(false),[refresh,setRefresh]=useState(0),[detailLoading,setDetailLoading]=useState(false);
  useEffect(()=>{let live=true;setLoading(true);setError("");
    apiFetch<Summary[]>(`/me/model-results?page=${page}`).then(data=>{if(live)setRows(data);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"读取失败，请重试");}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};},[page,refresh]);
  useEffect(()=>{let live=true;setDetail(null);setCopied(false);setDetailLoading(!!selected);if(!selected)return;
    apiFetch<Detail>(`/me/model-results/${encodeURIComponent(selected)}`).then(data=>{if(live)setDetail(data);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"读取失败，请重试");}).finally(()=>{if(live)setDetailLoading(false);});
    return()=>{live=false;};},[selected,refresh]);
  async function copy(){if(!detail)return;try{await navigator.clipboard.writeText(detail.content);setCopied(true);}catch{setError("复制失败，可在下方选中文字复制");}}
  function download(){if(!detail)return;const url=URL.createObjectURL(new Blob([detail.content],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`生成原文-${detail.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section style={{maxWidth:1000,margin:"0 auto",padding:24}} aria-label="生成原文">
    <h1>生成原文</h1><button type="button" disabled={loading||detailLoading} onClick={()=>setRefresh(v=>v+1)}>刷新</button><p>这里保留模型实际返回的完整文字。自动整理未完成时，仍可查看、复制和下载。仅本人可见。</p>
    {error&&<p role="alert">{error}</p>}
    {loading?<p role="status">正在读取…</p>:!rows.length?<p>暂无记录。此功能上线后的文字回复会在这里保留。</p>:<ul>{rows.map(row=><li key={row.id} style={{marginBottom:12}}>
      <button type="button" onClick={()=>setSelected(row.id)} aria-pressed={selected===row.id}>{row.model} · {new Date(row.createdAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})}</button>
    </li>)}</ul>}
    <div style={{display:"flex",gap:12}}><button type="button" disabled={page===0||loading} onClick={()=>setPage(v=>v-1)}>上一页</button><span>第 {page+1} 页</span><button type="button" disabled={rows.length<20||loading} onClick={()=>setPage(v=>v+1)}>下一页</button></div>
    {selected&&<article style={{marginTop:24}} aria-label="模型原始内容"><h2>模型原始内容</h2>
      {detail?<><p><button type="button" onClick={()=>void copy()}>{copied?"已复制":"复制全文"}</button>{" "}<button type="button" onClick={download}>下载原文</button></p>
      {detail.finishReason==="length"&&<p>模型因输出额度停止，以下是已返回的内容，可能未写完。</p>}
      <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"inherit",lineHeight:1.8}}>{detail.content}</pre></>:detailLoading?<p role="status">正在读取全文…</p>:<p>暂时无法读取，请点击刷新重试。</p>}
    </article>}
  </section>;
}
