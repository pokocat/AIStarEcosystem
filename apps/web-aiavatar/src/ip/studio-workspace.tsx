"use client";
import {filmStudyConnections} from '@/canvas-bridge/studio-film-study';
import { StudioErrorNotice, reportStudioError, reportStudioRunFailures, studioRunError, studioNodeError, studioErrorMetadata, normalizeStudioError, useStudioApp, useStudioErrorState } from './studio-errors';
import { StudioRecreation } from "./studio-recreation";
import { StudioTaskList } from "./studio-task-list";
import { studioTaskPresentation } from '@/canvas-bridge/studio-task-title';
import { StudioFloatingPanel } from "./studio-floating-panel";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { inferMediaRatio } from "@/canvas/lib/media-size";
import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { placeStudioNode } from "@/canvas-bridge/flow-document";
import { App, Button, Checkbox, Dropdown, Input, Modal, Popover, Select } from "antd";
import { ApiError } from "@ai-star-eco/api-client";
import { ArrowUp, ArrowLeftRight, BookOpen, Camera, Clapperboard, Download, Ellipsis, FileText, ImagePlus, Play, RotateCcw, SquareCheckBig, Upload, UserRound, X } from "lucide-react";
import { nanoid } from "nanoid";
import { LibraryExtractionPanel } from "./library-extraction-panel";
import { LibraryReferencePicker } from "./library-reference-picker";
import { attachmentNode, savedAssetPayload } from "@/canvas-bridge/studio-attachments";
import { libraryObjectAsset } from "@/canvas-bridge/library-reference";
import type { IpSavedAsset } from "@ai-star-eco/types";
import type { IpRun } from "@ai-star-eco/types";
import type { StudioCapabilities, StudioIpAsset, StudioIpAssetRole, StudioVoiceProfile, StudioOperation, StudioReference, StudioRunRequest, StudioScript, StudioScriptSettings, StudioPlan, StudioNodeMetadata } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { applyStudioRun, applyStudioRunToDocument, makeStudioNode, retainStudioMediaVersions, adoptStudioTake, studioGenerationPending, dispatchStudioCommand } from "@/canvas-bridge/studio-nodes";
import { adoptStudioImage, listStudioIpAssets, listStudioIps, readStudioProject, studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
import { markStudioDescendants, reorderStudioClips, studioNodeEpisode, studioNodeReferences, studioScriptPrompt, studioScriptInput, studioShotNodes } from "@/canvas-bridge/studio-script";
import { readRun, cancelRun, fetchModels, fetchStudioVideoModels, type IpModels } from "@/canvas-bridge/api";
import { studioQueueNotice, studioTaskLabel, studioTaskQueued } from '@/canvas-bridge/studio-task-status';
import { executionOutputMissing, readProjectedNodes } from '@/canvas-bridge/studio-plan-execution';
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { studioVideoSettings,studioVideoError,studioVideoQuote,studioVideoReferenceIds,studioVideoDraftFromReferences,changeStudioVideoDraft,studioVideoNodeSelection } from "@/canvas-bridge/studio-video";
import { StudioVideoControls,StudioVideoSeedControl,type StudioVideoDraft } from "./studio-video-controls";
import { StudioChoiceGroup, StudioModelPicker, StudioSettingsPopover, studioImageSizeLabel } from "./studio-generation-controls";
import { adaptStudioVideoReferences, studioVideoAcceptsReferences, studioVideoSelectionIds } from "@/canvas-bridge/studio-video-selection";
import { StudioReferencePicker, StudioReferenceStrip } from "./studio-composer-references";
import { StudioDurationControl } from "./studio-duration-control";
import { studioVideoModeName } from "@/canvas-bridge/studio-video";
import { StudioFrameIntentDialog, StudioVideoPromptNote, StudioVideoRewriteDetail, studioComposerTake, type StudioFrameIntentChoice } from "./studio-video-prompt-notes";
import { studioFrameIntent, studioFrameTarget, type StudioFrameIntent } from "@/canvas-bridge/studio-video-prompt";
import { studioDurationIssue, studioSpecConflict, studioSpecConflictText, studioSpecVideoDraft, type StudioSpecConflict } from "@/canvas-bridge/studio-composer-spec";
import { StudioFrameCropHint } from "./studio-frame-crop-hint";
import { studioFailedWithoutMedia, studioUnusableModel } from "@/canvas-bridge/studio-node-failure";
import { studioNodeCommand } from './studio-node-command';
import { studioVideoPromptReferences, rebindStudioVideoMentions } from '@/canvas-bridge/studio-video-references';
import { StudioAssetMentionInput } from "./studio-asset-mention-input";
import { StudioMotionPrompt } from "./studio-motion-prompt";
import { encodeChannelModel } from "@/canvas-bridge/config-store";
import { AiMark, StudioAiIcon } from "./studio-ai-icon";
import { SERVER_CHANNEL_ID, endpointIdFor } from "@/canvas-bridge/models";
import { computeVideoSize } from "@/canvas/lib/media-size";
import { saveStudioDocument } from "@/canvas-bridge/studio-save";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { parseStudioCaptions, studioWorkDraft, updateStudioWorkDraft } from "@/canvas-bridge/studio-packaging";
import { StudioScriptSettingsForm } from "./studio-script-settings";
import { StudioScriptEditor } from "./studio-script-editor";
import { StudioTextComposer } from "./studio-text-composer";
import { studioChosenTextModel } from "@/canvas-bridge/studio-text-model";
import { scriptToMarkdown } from "@/canvas-bridge/studio-script-markdown";
import { StudioTemplateLibrary } from "./studio-template-library";
import { StudioSpeech } from "./studio-speech";
import { StudioVoiceAdopt } from "./studio-voice-adopt";
import { StudioLipSync } from "./studio-lip-sync";
import { submitStudioSpeech, submitStudioLipSync, extractStudioLipSync } from "@/canvas-bridge/studio-api";
import type { StudioSpeechRequest, StudioLipSyncRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { StudioAssistant } from "./studio-assistant";
import { useStudioConversations } from "@/canvas-bridge/studio-conversations";
import { StudioBatchPanel } from "./studio-batch-panel";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { StudioWorkEditor } from "./studio-work-editor";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useLayoutMode } from "@/shell/layout-mode";
import type { StudioAdvancedEdit, StudioEditTimeline } from "@ai-star-eco/types/ip-studio-workflow";
import { studioClipEpisode, studioClipIncluded, studioSourceClipIds } from "@/canvas-bridge/studio-work-clips";
import { StudioIpLibrary } from "./studio-ip-library";
import { StudioMaterialLibrary } from './studio-material-library';
import { editableIpAssetRoles,ipAssetRole,ipAssetRoles } from "@/canvas-bridge/studio-ip-library";
import { parseStudioEntry } from "./studio-entry";
import { StudioCanvasGuide, studioCanvasGuideVisible } from "./studio-canvas-guide";
import { IpStudioApi } from "./api";
import { studioLinkedInputError, studioLinkedNodes, studioLinkedText, withStudioLinkedText } from '@/canvas-bridge/studio-linked-inputs';
import { StudioStoryboard } from './studio-storyboard';
import { updateStudioStoryboardShot } from '@/canvas-bridge/studio-storyboard';

type Props = { projectId: string; nodes: CanvasNodeData[]; connections:CanvasConnection[]; selectedNodeIds: Set<string>;
  setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>; setConnections: Dispatch<SetStateAction<CanvasConnection[]>>;
  onFocusNode: (id: string) => void; onClosePanel: () => void; onRestorePanel: (id:string) => void; activeComposerId?:string; referencePicking?:boolean;
  textEditingNodeId?:string; renderTextEditor?:(actions:ReactNode)=>ReactNode };
const containers = () => document.querySelector<HTMLElement>(".ip-surface") || document.body;
// 高级编辑（Twick）只有点开才下载：它带着播放器、时间线和导出引擎，体积不小。
const StudioAdvancedEditor = dynamic(() => import("./studio-advanced-editor").then(m => m.StudioAdvancedEditor), { ssr: false,
  loading: () => <div className="studio-advanced-shell studio-advanced-loading" role="status">正在打开高级编辑…</div> });
const labels = { recreation: "解析视频", text: "AI 修改文本", script: "创作剧本", storyboard: "拆分镜头", image: "生成图片", video: "生成视频", assemble: "合成作品", assistant: "导演对话" };
const legacyBatchCounts=[1,2,4];
function imageRatioLabel(ratio:string){
  const [width,height]=ratio.split(":").map(Number);
  if(!(width>0&&height>0))return ratio;
  return `${width===height?"方图":width>height?"横图":"竖图"} ${ratio}`;
}

/** Per-browser memory of whether the assistant panel was last open; desktop canvases default to open. */
const ASSISTANT_OPEN_KEY="studio-assistant:open";
function readAssistantOpenPreference(){
  // Only an explicit desktop shell opens it by itself (tests and the mobile shell start closed).
  if(typeof document==="undefined"||document.documentElement.dataset.layout!=="desktop")return false;
  try{return localStorage.getItem(ASSISTANT_OPEN_KEY)!=="0";}catch{return true;}
}
export function StudioWorkspace({ projectId, nodes, connections, selectedNodeIds, setNodes, setConnections, onFocusNode, onClosePanel, onRestorePanel, activeComposerId, referencePicking, textEditingNodeId, renderTextEditor }: Props) {
  const { message, modal } = useStudioApp();
  const {conversations,setConversations}=useStudioConversations(projectId);
  const [missingPlanRefs,setMissingPlanRefs]=useState<string[]>([]);
  const [workSaving,setWorkSaving]=useState(false);
  const [capabilities, setCapabilities] = useState<StudioCapabilities>();
  const [capabilityError, setCapabilityError] = useStudioErrorState();
  const [mode, setMode] = useState<"canvas" | "storyboard" | "work">("canvas");
  const [director, setDirector] = useState(false);
  const [recreationMode,setRecreationMode]=useState<"segments"|undefined>();
  const [recreationOpen,setRecreationOpen]=useState(false),[recreationId,setRecreationId]=useState<string>();
  const [storyboardNodeId,setStoryboardNodeId]=useState<string>();
  const [storyboardChanging,setStoryboardChanging]=useState(false);
  const [storyboardTextExpanded,setStoryboardTextExpanded]=useState(false);
  useEffect(()=>{
    if(storyboardNodeId&&!nodes.some(n=>n.id===storyboardNodeId)){setStoryboardNodeId(undefined);setStoryboardTextExpanded(false);setDirector(false);}
  },[nodes,storyboardNodeId]);
  const [pickingReferences,setPickingReferences]=useState(false);
  const [operation, setOperation] = useState<StudioOperation>("script");
  const [prompt, setPrompt] = useState("");
  const [originId, setOriginId] = useState<string>();
  // The node the composer is for was deleted (Delete key, cut, undo): close the composer, like the storyboard detail above.
  // Only once the node has been on the canvas: a node added together with opening its composer can arrive a render later.
  const originSeen=useRef<string|undefined>(undefined);
  useEffect(()=>{
    if(!director||!originId){originSeen.current=undefined;return;}
    if(nodes.some(n=>n.id===originId)){originSeen.current=originId;return;}
    if(originSeen.current===originId){originSeen.current=undefined;setPickingReferences(false);setDirector(false);}
  },[director,originId,nodes]);
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [ratio, setRatio] = useState("9:16");
  const [composerSettingsOpen,setComposerSettingsOpen]=useState(false);
  useEffect(()=>{setComposerSettingsOpen(false);},[originId,operation,director]);
  const [imageSize,setImageSize]=useState<string>();
  const [busy, setBusy] = useState(false);
  const [directorSaving,setDirectorSaving]=useState(false);
  const [editorId, setEditorId] = useState<string>();
  const [extractionId,setExtractionId]=useState<string>();
  const [libraryQuery,setLibraryQuery]=useState<string>();
  const libraryMention=useRef<{start:number;end:number}|undefined>(undefined);
  const openLibrary=(query:string)=>{const start=prompt.lastIndexOf("@"+query);libraryMention.current=start>=0?{start,end:start+query.length+1}:undefined;setLibraryQuery(query);};
  const openExtraction=async(id:string)=>{try{await saveStudioDocument(projectId);setExtractionId(id);}catch(e){message.error(e);}};
  const insertLibrary=async(assets:IpSavedAsset[])=>{const chosen:string[]=[];setNodes(list=>{const next=[...list];for(const a of assets){const n=attachmentNode(savedAssetPayload(a),next);if(!next.some(x=>x.id===n.id))next.push(n);chosen.push(n.id);}return next;});await saveStudioDocument(projectId);setReferenceIds(ids=>[...new Set([...ids,...chosen])]);const mention=libraryMention.current;if(mention)setPrompt(value=>value.slice(0,mention.start)+assets.map(a=>"@"+a.title).join(" ")+value.slice(mention.end));libraryMention.current=undefined;};
  const [scriptPreviewId,setScriptPreviewId]=useState<string>();
  const panelSession=useRef(0);
  const [adoptId, setAdoptId] = useState<string>();
  const [adoptName, setAdoptName] = useState("");
  const [adoptIp, setAdoptIp] = useState<string>();
  const [adoptAvatar, setAdoptAvatar] = useState<string>();
  const [adoptIntent, setAdoptIntent] = useState<"main"|"look">("main");
  const [adoptRole,setAdoptRole]=useState<StudioIpAssetRole>("look");
  const [ips, setIps] = useState<{ id: string; name: string }[]>([]);
  const [taskList, setTaskList] = useState(false);
  const [runDetail,setRunDetail]=useState<IpRun>();
  const [runs, setRuns] = useState<IpRun[]>([]);
  const taskRuns=useMemo(()=>[...runs].sort((a,b)=>{
    const rank=(r:IpRun)=>r.status==='running'?(studioTaskQueued(r)?1:0):2;
    return rank(a)-rank(b)||(studioTaskQueued(a)&&studioTaskQueued(b)?(a.queue?.position??Infinity)-(b.queue?.position??Infinity):0)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id);
  }),[runs]);
  const [refreshErrors,setRefreshErrors]=useState<Record<string,boolean>>({});
  const terminalRuns=useRef(new Map<string,IpRun>());
  const [taskPage,setTaskPage]=useState(0),[taskMore,setTaskMore]=useState(false),[tasksLoading,setTasksLoading]=useState(false),[taskError,setTaskError]=useStudioErrorState();
  const [assetPicker, setAssetPicker] = useState(false);
  const directorLibraryButton = useRef<HTMLButtonElement>(null);
  const [libraryTarget,setLibraryTarget]=useState<{kind:"canvas"|"node"|"director";nodeId?:string;returnNodeId?:string}>({kind:"canvas"});
  const [ipAssets, setIpAssets] = useState<StudioIpAsset[]>([]);
  const [assetError, setAssetError] = useStudioErrorState();
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [pasteScript, setPasteScript] = useState(false);
  const [scriptMode,setScriptMode]=useState<"original"|"adapt">("original");
  const [scriptSourceNodeId,setScriptSourceNodeId]=useState<string>();
  const [models, setModels] = useState<IpModels>({image:[],video:[]});
  const [nativeVideoModels,setNativeVideoModels]=useState<VideoStudioModel[]>([]);
  const manualVideoModes=useRef(new Map<string,string>());
  const [videoDraft,setVideoDraft]=useState<StudioVideoDraft>({mode:"t2v",tier:"768p"});
  // 描述里写了图1 / 首帧 / 尾帧、请求里却没有那些图：提交前问一次（同一段描述 + 模式答过「仍按文字生成」就不再问）。
  const [frameIntent,setFrameIntent]=useState<{intent:StudioFrameIntent;resolve:(choice:StudioFrameIntentChoice)=>void}>();
  const [specConflict,setSpecConflict]=useState<{conflict:StudioSpecConflict;resolve:(choice:"adopt"|"keep"|"cancel")=>void}>();
  const specConflictAnswered=useRef(new Set<string>());
  const frameIntentAnswered=useRef(new Set<string>()),focusFrameSlot=useRef(false);
  const [referencePickerRequest,setReferencePickerRequest]=useState(0);
  const [model, setModel] = useState<string>();
  const [duration, setDuration] = useState(8);
  const [imageCount,setImageCount]=useState(1);
  const [videoCount,setVideoCount]=useState(1);
  const [rewriteScope,setRewriteScope]=useState<{field:"outline"|"episode";episodeNo?:number}>();
  const [assistantNodeId,setAssistantNodeId]=useState<string>(),[batchNodeId,setBatchNodeId]=useState<string>();
  const [templateLibraryOpen,setTemplateLibraryOpen]=useState(false),[assistantOpen,setAssistantOpen]=useState(readAssistantOpenPreference),[batchOpen,setBatchOpen]=useState(false);
  // The assistant is the default way in: open on every desktop canvas until the user closes it; closing (or opening) is remembered per browser.
  useEffect(()=>{if(typeof document==="undefined"||document.documentElement.dataset.layout!=="desktop")return;try{localStorage.setItem(ASSISTANT_OPEN_KEY,assistantOpen?"1":"0");}catch{/* not remembered */}},[assistantOpen]);
  const [templateScope,setTemplateScope]=useState<"all"|"commerce"|"digital">("all");
  const openTemplates=async(scope:typeof templateScope="all")=>{try {await saveStudioDocument(projectId);setTemplateScope(scope);setTemplateLibraryOpen(true);onClosePanel();}catch(e){message.error(e);}};
  const [entryBrief,setEntryBrief]=useState(""),[entryAutoSend,setEntryAutoSend]=useState(false);
  const [entryAssistantMode,setEntryAssistantMode]=useState<"general"|"director">();
  const [lipSyncOpen,setLipSyncOpen]=useState(false);
  const [lipOriginId,setLipOriginId]=useState<string>();
  const openLipSync=(node?:CanvasNodeData)=>{setLipOriginId(node?.id);setDirector(false);setLipSyncOpen(true);onClosePanel();};
  const [voiceAdoptId,setVoiceAdoptId]=useState<string>();
  const [speechOpen,setSpeechOpen]=useState(false);
  const [speechOriginId,setSpeechOriginId]=useState<string>(),[speechSaving,setSpeechSaving]=useState(false);
  const [settings,setSettings]=useState<StudioScriptSettings>({genre:"都市治愈",episodeCount:1,episodeDurationSec:30});
  const [episodeNo,setEpisodeNo]=useState<number>(),[episodeFilter,setEpisodeFilter]=useState<number|"all">("all");
  const [takePicker,setTakePicker]=useState<string>();
  const [contextMoreOpen,setContextMoreOpen]=useState<string>();
  useEffect(()=>{setContextMoreOpen(undefined);},[selectedNodeIds]);
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  // Output of a plan execution that finished while this canvas was closed: let the assistant restore it on open.
  const executionRestorePending = useMemo(() => executionOutputMissing(runs, nodesRef.current, readProjectedNodes(projectId)), [runs, projectId]);
  const storyRevisions=useRef<{projectId:string;values:Map<string,string>} | undefined>(undefined);
  // Plain text edits use the canvas inspector; watch their body too, without replaying any run.
  useEffect(()=>{
    const values=new Map(nodes.filter(n=>n.type===CanvasNodeType.Text).map(n=>[n.id,JSON.stringify([n.title,n.metadata?.studio?.script?studioScriptPrompt(n.metadata.studio.script,""):n.metadata?.content])]));
    const previous=storyRevisions.current;
    storyRevisions.current={projectId,values};
    if(!previous || previous.projectId!==projectId)return;
    const changed=[...new Set(nodes.flatMap(n=>n.metadata?.studio?.scriptSourceNodeId?[n.metadata.studio.scriptSourceNodeId]:[]))]
      .filter(id=>previous.values.has(id)&&previous.values.get(id)!==values.get(id));
    if(changed.length)setNodes(current=>changed.reduce((list,id)=>markStudioDescendants(list,id),current));
  },[nodes,projectId,setNodes]);
  // Restore visible story lineage from saved bindings without replaying the accepted request.
  useEffect(()=>{
    const sources=nodes.filter(n=>n.metadata?.studio?.scriptSourceNodeId&&n.metadata.studio.scriptSourceNodeId!==n.id&&nodes.some(source=>source.id===n.metadata!.studio!.scriptSourceNodeId));
    setConnections(current=>{
      const missing=sources.filter(n=>!current.some(c=>c.toNodeId===n.id&&c.fromNodeId===n.metadata!.studio!.scriptSourceNodeId));
      return missing.length?[...current,...missing.map(n=>({id:nanoid(),fromNodeId:n.metadata!.studio!.scriptSourceNodeId!,toNodeId:n.id}))]:current;
    });
  },[nodes,setConnections]);
  const connectionsRef=useRef(connections);connectionsRef.current=connections;
  const watching = useRef(new Set<string>());
  const materialized = useRef(new Set<string>());
  const pendingIpImport=useRef<{identity:string;nodeId:string}|undefined>(undefined);
  const pendingScriptImport=useRef<string|undefined>(undefined);
  const startOpened = useRef<string|undefined>(undefined);
  const alive = useRef(true);
  const epoch = useRef(0);
  const selected = selectedNodeIds.size===1 ? nodes.find(n => selectedNodeIds.has(n.id)) : undefined;
  const selectedStudio=selected?.metadata?.studio;
  const speechOrigin=nodes.find(n=>n.id===speechOriginId);
  const referencedPeople=[...new Set(selectedStudio?.references?.flatMap(r=>r.avatarId?[r.avatarId]:[])||[])];
  const speechAvatarId=selectedStudio?.speechRequest?.avatarId||selectedStudio?.voiceProfile?.avatarId||selectedStudio?.adoption?.avatarId||(referencedPeople.length===1?referencedPeople[0]:undefined);
  const editor = nodes.find(n => n.id === editorId);
  const allShots = nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.studio?.shot)
    .sort((a,b)=>(studioNodeEpisode(a)||1)-(studioNodeEpisode(b)||1)||(a.metadata?.studio?.order||0)-(b.metadata?.studio?.order||0));
  const shots=allShots.filter(n=>episodeFilter==="all"||(studioNodeEpisode(n)||1)===episodeFilter);
  const allClips = nodes.filter(n => n.type === CanvasNodeType.Video && n.metadata?.storageKey && n.metadata?.studio?.kind !== "work" && (!n.metadata.templateStepId || n.metadata.studio?.templateAccepted===true))
    .sort((a,b) => studioClipEpisode(a)-studioClipEpisode(b) || (a.metadata?.studio?.order || 0) - (b.metadata?.studio?.order || 0));
  const clips=allClips.filter(n=>episodeFilter==="all"||studioClipEpisode(n)===episodeFilter);
  // The original a recreation copies is an input, not a cut: one rule decides inclusion for the editor and the request.
  const sourceClipIds=useMemo(()=>studioSourceClipIds(nodes,connections),[nodes,connections]);
  const work = nodes.filter(n => n.metadata?.studio?.kind === "work"&&!n.metadata.studio.workDraft&&(episodeFilter==="all"||n.metadata.studio.episodeNo===episodeFilter||n.metadata.studio.episodeNo===undefined&&new Set(allShots.map(s=>s.metadata?.studio?.episodeNo||s.metadata?.studio?.shot?.episodeNo||1)).size<=1));
  const referenceOptions = nodes.filter(n => n.type === CanvasNodeType.Image && n.metadata?.storageKey || n.metadata?.studio?.adoption || (operation==="video"||n.type===CanvasNodeType.Image)&&referenceIds.includes(n.id));
  const patch = useCallback((id: string, update: (node: CanvasNodeData) => CanvasNodeData) => setNodes(current => current.map(n => n.id === id ? update(n) : n)), [setNodes]);
  const workEpisode=episodeFilter==='all'?undefined:episodeFilter;
  const workDraft=studioWorkDraft(nodes,workEpisode);
  const {packagingEnabled,brand,title:workTitle,cta,captionText,voiceoverStorageKey:voiceoverKey}=workDraft;
  const changeWorkDraft=(changes:Partial<typeof workDraft>)=>{const id=nanoid();setNodes(current=>updateStudioWorkDraft(current,changes,id,workEpisode));};
  const saveWork=async(nextMode?:typeof mode)=>{
    if(workSaving)return;setWorkSaving(true);
    try{await saveStudioDocument(projectId);if(nextMode)setMode(nextMode);else message.success('成片配置已保存');}
    catch(e){message.error(e);}
    finally{setWorkSaving(false);}
  };
  const workVoiceMissing=!!voiceoverKey&&!nodes.some(n=>n.type===CanvasNodeType.Audio&&n.metadata?.storageKey===voiceoverKey&&n.metadata.status==='success');
  const chooseTake=(id:string,takeId:string)=>setNodes(current=>adoptStudioTake(current,id,takeId));
  const loadCapabilities = useCallback(() => {
    setCapabilityError(""); void studioCapabilities().then(setCapabilities).catch(e => setCapabilityError(e));
  }, []);
  useEffect(() => { loadCapabilities(); }, [loadCapabilities]);
  useEffect(() => {void Promise.all([fetchModels(),fetchStudioVideoModels()]).then(([basic,native])=>{setModels(basic);setNativeVideoModels(native);}).catch(e=>message.error(e));}, [message]);
  useEffect(() => { alive.current = true; epoch.current++;terminalRuns.current.clear();setRefreshErrors({}); return () => { alive.current = false; epoch.current++; }; }, [projectId]);
  const materializeStoryboard = useCallback((parentId: string, script: StudioScript) => {
    const parent = nodesRef.current.find(n => n.id === parentId);
    if (!parent) return;
    if (materialized.current.has(`${projectId}:${parentId}`) || nodesRef.current.some(n=>n.metadata?.studio?.parentNodeId===parentId && n.metadata.studio.shot)) return;
    materialized.current.add(`${projectId}:${parentId}`);
    const created = studioShotNodes(parent, script);
    setNodes(current => current.some(n => n.metadata?.studio?.parentNodeId === parentId && n.metadata.studio.shot) ? current : [...current, ...created]);
    setConnections(current => current.some(c => c.fromNodeId === parentId && created.some(n => n.id === c.toNodeId)) ? current :
      [...current, ...created.map(n => ({ id: nanoid(), fromNodeId: parentId, toNodeId: n.id }))]);
    setMode("storyboard");
  }, [projectId, setNodes, setConnections]);

  // A terminal run found during initial recovery is old state, not a new completion event.
  const watch = useCallback(async (run: IpRun, targetId?: string, restored = false) => {
    const token = epoch.current;
    const watchKey = `${token}:${run.id}`;
    if (watching.current.has(watchKey)) return;
    watching.current.add(watchKey);
    let current = run;
    let historical = restored;
    try {
      while (alive.current && epoch.current === token) {
        current=terminalRuns.current.get(current.id)||current;
        if(targetId){setNodes(nodes => applyStudioRunToDocument(nodes,connectionsRef.current,targetId!,current));if(current.output.filmStudy||current.output.sourceAudio)setConnections(edges=>filmStudyConnections(edges,targetId!,current,nodesRef.current));}
        setRuns(list => [current, ...list.filter(r => r.id !== current.id)]);
        if (!historical) reportStudioRunFailures(current);
        if (current.status !== "running") {
          setRefreshErrors(old=>{const next={...old};delete next[current.id];return next;});
          if (targetId && nodesRef.current.some(n=>n.id===targetId&&n.metadata?.studio?.runId===current.id) && current.status === "done" && current.kind === "studio-storyboard" && current.output.script) materializeStoryboard(targetId, current.output.script);
          if (!historical && current.status === "done"&&current.output.billing) message.success(`已消耗 ${current.output.billing.credits} 积分`);
          void saveStudioDocument(projectId).catch(e => message.error(e));
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (!alive.current || epoch.current !== token) return;
        try {
          current = await readRun(current.id);
          if(!alive.current||epoch.current!==token)return;
          historical = false;
          setRefreshErrors(old=>{if(!old[current.id])return old;const next={...old};delete next[current.id];return next;});
        }
        catch (error) {
          if(!alive.current||epoch.current!==token)return;
          reportStudioError({...normalizeStudioError(error),taskId:current.id},{once:`poll:${current.id}`});
          setRefreshErrors(old=>({...old,[current.id]:true}));
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } finally { watching.current.delete(watchKey); }
  }, [setNodes, message, projectId, materializeStoryboard]);

  useEffect(() => {
    let cancelled = false;
    void readStudioProject(projectId).then(project => {
      if (cancelled) return;
      const all = Object.values(project.runsById || project.runs || {});
      setRuns(all);
      for (const node of nodesRef.current) {
        const studio = node.metadata?.studio;
        const savedRequest=studio?.lipSyncRequest||studio?.speechRequest||studio?.request;
        const match = all.find(r => r.id === studio?.runId || r.id === node.metadata?.runId || (savedRequest && r.nodeId === node.id && (r.inputs as unknown as StudioRunRequest).clientRequestId === savedRequest.clientRequestId));
        if (node.metadata?.status !== "loading") {
          // Restore authoritative terminal semantics in older documents without replaying media or edited script results.
          if (match && match.status !== "running" && (studio?.runId === match.id || node.metadata?.runId === match.id)) {
            patch(node.id, current => current.metadata?.studio?.runId === match.id || current.metadata?.runId === match.id
              ? { ...current, metadata: { ...current.metadata, studio: { ...current.metadata.studio!, task: {
                status: match.status, stage: match.stage, pct: match.pct, errorCode: match.errorCode, errorMessage: match.errorMessage, logId: match.logId || match.output.logId, queue: null,
              } } } } : current);
          }
          continue;
        }
        if (match) void watch(match, node.id, match.status !== "running");
      }
    }).catch(e => message.error(e));
    return () => { cancelled = true; };
  }, [projectId, watch, patch, message]);

  // Native node generation and the Studio drawer share the same task list; snapshots do not submit work.
  useEffect(()=>{
    const listener=(event:Event)=>{
      const run=(event as CustomEvent<IpRun>).detail;
      if(run.projectId===projectId)setRuns(current=>[run,...current.filter(r=>r.id!==run.id)]);
    };
    window.addEventListener('studio-native-run',listener);
    return()=>window.removeEventListener('studio-native-run',listener);
  },[projectId]);
  const loadTasks=useCallback(async(page=0)=>{
    setTasksLoading(true);setTaskError("");const token=epoch.current;
    try {
      // Project restoration is only a latest-run projection; task history must include failed/replaced runs.
      const result=await IpStudioApi.listProjectRuns(projectId,page);
      if(epoch.current!==token)return;
      setRuns(current=>[...new Map([...current,...result.items].map(run=>[run.id,run])).values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)));
      setTaskPage(page);setTaskMore(result.hasMore);
      for(const run of result.items)if(run.status==='running')void watch(run,nodesRef.current.some(n=>n.id===run.nodeId&&n.metadata?.studio?.runId===run.id)?run.nodeId:undefined);
    }catch(e){if(epoch.current===token)setTaskError(e);}
    finally{if(epoch.current===token)setTasksLoading(false);}
  },[projectId,watch]);
  useEffect(()=>{if(taskList)void loadTasks();},[taskList,loadTasks]);

  const addNode = useCallback((node: CanvasNodeData, origin?: CanvasNodeData) => {
    setNodes(current => [...current, placeStudioNode(node,current)]);
    if (origin) setConnections(current => [...current, { id: nanoid(), fromNodeId: origin.id, toNodeId: node.id }]);
    setTimeout(() => onFocusNode(node.id), 0);
  }, [setNodes, setConnections, onFocusNode]);
  const openSpeech=useCallback((source?:CanvasNodeData)=>{
    panelSession.current++;
    let node=source?.type===CanvasNodeType.Audio?source:undefined;
    if(!node){node={id:nanoid(),type:CanvasNodeType.Audio,title:'人物配音',width:360,height:220,
      position:{x:source?source.position.x+source.width+90:100,y:source?.position.y||120},metadata:{status:'idle',prompt:source?.metadata?.studio?.shot?.dialogue||'',studio:{kind:'audio',parentNodeId:source?.id,references:source?studioNodeReferences(source,'character'):[],voiceProfile:source?.metadata?.studio?.voiceProfile}}};addNode(node,source);}
    setSpeechOriginId(node.id);setSpeechOpen(true);onClosePanel();
  },[addNode,onClosePanel]);
  const updateSpeechDraft=useCallback((draft:NonNullable<StudioNodeMetadata['speechDraft']>)=>{
    if(!speechOriginId)return;
    patch(speechOriginId,n=>JSON.stringify(n.metadata?.studio?.speechDraft)===JSON.stringify(draft)?n:{...n,metadata:{...n.metadata,prompt:draft.text,studio:{kind:'audio',...n.metadata?.studio,speechDraft:draft}}});
  },[speechOriginId,patch]);
  const closeSpeech=async()=>{
    if(speechSaving||busy)return;setSpeechSaving(true);const session=panelSession.current;
    try{await saveStudioDocument(projectId);if(panelSession.current===session)setSpeechOpen(false);}catch(e){message.error(e);}finally{setSpeechSaving(false);}
  };
  const openDirector = useCallback((action: StudioOperation, node?: CanvasNodeData, presentation: "canvas" | "storyboard" = "canvas") => {
    panelSession.current++;setScriptPreviewId(undefined);
    pendingScriptImport.current=undefined;
    // The same creator serves both the canvas float and storyboard detail.
    setMode(presentation);
    const focusedNodeId=node?.id;
    if(focusedNodeId&&presentation==="canvas")setTimeout(()=>onFocusNode(focusedNodeId),0);
    setPickingReferences(false);setEditorId(undefined);setTemplateLibraryOpen(false);setSpeechOpen(false);
    if((action==="image"||action==="video")&&node?.metadata?.templateStepId) {
      setDirector(false);onClosePanel();
      window.dispatchEvent(new CustomEvent("studio-template-step",{detail:{projectId,stepId:node.metadata.templateStepId}}));
      return;
    }
    // A creator opened from an empty canvas still owns a saved document node.
    // Closing, refreshing and returning must resume the same draft, not a detached form.
    if(!node && ["text","script","storyboard","image","video"].includes(action)) {
      node=makeStudioNode(action);addNode(node);
    }
    if(presentation==="storyboard")setStoryboardNodeId(node?.id);
    const parent=nodesRef.current.find(n=>n.id===node?.metadata?.studio?.parentNodeId);
    setScriptMode(node?.metadata?.studio?.scriptMode||"original");setScriptSourceNodeId(node?.metadata?.studio?.scriptSourceNodeId);
    setOperation(action); setOriginId(node?.id);setPasteScript(false);setModel(["text","script","storyboard"].includes(action)?node?.metadata?.studio?.request?.model:undefined);setRewriteScope(undefined);setMissingPlanRefs([]);setEpisodeNo(undefined);setSettings(node?.metadata?.studio?.settings||{genre:"都市治愈",episodeCount:node?.metadata?.studio?.script?.episodes.length||1,episodeDurationSec:30});setRatio(action==="image"?node?.metadata?.studio?.shot?parent?.metadata?.studio?.request?.aspectRatio||"9:16":"3:4":"9:16");
    setImageSize(undefined);
    const script = node?.metadata?.studio?.script;
    const scriptInstruction=action==="storyboard"?"根据当前已编辑的剧本拆分镜头。保留人物设定、台词和顺序。":"改写当前剧本，保留选定的人物设定。";
    setPrompt(script && (action === "script" || action === "storyboard") ? presentation==="storyboard"?scriptInstruction:studioScriptPrompt(script,scriptInstruction) : action==="video"&&node?.type===CanvasNodeType.Image ? node.metadata?.studio?.shot?.description || "以选中的图片作为首帧，保持主体、服饰和场景。请描述人物动作、镜头运动和节奏，动作自然连贯。" : node?.metadata?.studio?.shot?.description || node?.metadata?.prompt || "");
    if(action==="text")setPrompt("");
    const ownKey = node?.type!==CanvasNodeType.Video && (node?.metadata?.storageKey || node?.metadata?.studio?.adoption);
    const inherited = node?.metadata?.studio?.references || [];
    const inheritedIds=ownKey ? [node!.id] : inherited.flatMap(ref => {
      const match = nodesRef.current.find(n => (n.metadata?.storageKey || n.metadata?.studio?.adoption?.storageKey) === ref.storageKey);
      return match ? [match.id] : [];
    });
    if(action==="video") {
      // Empty upstream slots still own their edges; opening an editor must not erase the workflow.
      const inputs=node?.type===CanvasNodeType.Video?studioLinkedNodes(node.id,nodesRef.current,connectionsRef.current):undefined;
      const ids=inputs?inputs.filter(input=>[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].includes(input.type as CanvasNodeType)).map(input=>input.id):inheritedIds;
      const selection=studioVideoNodeSelection(node,nodesRef.current,ids);
      // What the assistant wrote from the conversation (studio.spec) wins over the node's defaults; its references are
      // already edges into the node, so they are in `ids`.
      const spec=node?.metadata?.studio?.spec;
      setVideoCount(spec?.count||selection.count);setDuration(spec?.durationSec||selection.seconds);setRatio(spec?.aspectRatio||selection.ratio);
      // Roles decide frames vs references (a person picture is never taken as the first frame because it came first).
      setVideoDraft(studioSpecVideoDraft(spec,selection.draft));setReferenceIds(ids);
      setModel(node?.type===CanvasNodeType.Video?node.metadata?.studio?.request?.model||(node.metadata?.model?endpointIdFor(node.metadata.model)||node.metadata.model:undefined):undefined);
    } else {
      const connected=node?studioLinkedNodes(node.id,nodesRef.current,connectionsRef.current).filter(ref=>ref.type===CanvasNodeType.Image).map(ref=>ref.id):[];
      setReferenceIds([...new Set([...inheritedIds,...connected])]);
      if(action==="image") {
        const saved=node?.metadata?.studio?.request;
        setImageSize(saved?.size||node?.metadata?.size);
        setImageCount(saved?.count||node?.metadata?.count||1);
        if(node?.metadata?.size)setRatio(inferMediaRatio(node.metadata.size,"3:4"));
        setModel(saved?.model||(node?.metadata?.model?endpointIdFor(node.metadata.model)||node.metadata.model:undefined));
        if(saved?.aspectRatio)setRatio(saved.aspectRatio);
        const spec=node?.metadata?.studio?.spec;
        if(spec?.aspectRatio)setRatio(spec.aspectRatio);
        if(spec?.count)setImageCount(spec.count);
      }
    }
    const draft=node?.metadata?.studio?.composerDraft;
    if(draft?.operation===action) {
      setPasteScript(draft.pasteScript||false);
      // A resumed prompt must keep the selected episode and local rewrite boundary.
      setEpisodeNo(draft.episodeNo);setRewriteScope(draft.rewriteScope);setScriptMode(draft.scriptMode||node?.metadata?.studio?.scriptMode||"original");setScriptSourceNodeId(draft.scriptSourceNodeId);
      setPrompt(presentation==="storyboard"&&script&&draft.prompt===studioScriptPrompt(script,scriptInstruction)?scriptInstruction:draft.prompt);setRatio(draft.aspectRatio);setModel(draft.model);setDuration(draft.durationSec);setSettings(draft.settings);
      const incoming=connectionsRef.current.filter(c=>c.toNodeId===node?.id).flatMap(c=>{
        const ref=nodesRef.current.find(n=>n.id===c.fromNodeId);return ref&&[CanvasNodeType.Image,...(action==="video"?[CanvasNodeType.Video,CanvasNodeType.Audio]:[])].includes(ref.type as CanvasNodeType)?[ref.id]:[];
      });
      const disconnected=new Set((draft.connectedReferenceNodeIds||[]).filter(id=>!incoming.includes(id)));
      setReferenceIds([...new Set([...draft.referenceNodeIds.filter(id=>!disconnected.has(id)&&nodesRef.current.some(n=>n.id===id)),...incoming])]);
      if(action==="image"){setImageCount(draft.count);setImageSize(draft.size);}if(action==="video"){setVideoCount(draft.count);setVideoDraft(draft.video);}
    }
    onClosePanel(); setDirector(true);
  }, [onClosePanel,projectId,addNode,onFocusNode]);
  useEffect(()=>{
    if(!director||!originId)return;
    const connectedReferenceNodeIds=connectionsRef.current.filter(c=>c.toNodeId===originId&&nodesRef.current.some(n=>n.id===c.fromNodeId&&[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].includes(n.type as CanvasNodeType))).map(c=>c.fromNodeId);
    const draft={operation,prompt,referenceNodeIds:referenceIds,connectedReferenceNodeIds,aspectRatio:ratio,model,size:operation==="image"?imageSize:undefined,count:operation==="video"?videoCount:imageCount,durationSec:duration,settings,video:videoDraft,pasteScript,episodeNo,rewriteScope,scriptMode,scriptSourceNodeId};
    patch(originId,n=>({...n,metadata:{...n.metadata,studio:{kind:n.metadata?.studio?.kind||(operation==="text"?"text":"shot"),...n.metadata?.studio,composerDraft:draft}}}));
  },[director,originId,operation,prompt,referenceIds,ratio,model,imageSize,videoCount,imageCount,duration,settings,videoDraft,pasteScript,episodeNo,rewriteScope,scriptMode,scriptSourceNodeId,patch]);
  const closeDirector=async()=>{
    if(busy||directorSaving)return false;
    setPickingReferences(false);
    setDirectorSaving(true);const session=panelSession.current;
    try{await saveStudioDocument(projectId);if(panelSession.current===session)setDirector(false);return true;}
    catch(e){message.error(e);return false;}
    finally{setDirectorSaving(false);}
  };
  // Switching nodes/types must persist the old draft first. A failed save keeps its editor visible.
  const saveStoryboardSelection=async()=>{
    if(storyboardChanging||directorSaving||busy)return false;
    if(director)return closeDirector();
    if(!storyboardNodeId)return true;
    setStoryboardChanging(true);
    try{await saveStudioDocument(projectId);return true;}
    catch(e){message.error(e);return false;}
    finally{setStoryboardChanging(false);}
  };
  const switchView=async(next:typeof mode)=>{
    if(mode==="storyboard"&&!await saveStoryboardSelection())return;
    if(mode!=="storyboard"&&director&&!await closeDirector())return;
    if(mode==='work'&&next!=='work')await saveWork(next);else setMode(next);
    if(next!=="storyboard")setStoryboardNodeId(undefined);
    onClosePanel();
  };
  const viewCanvasNode=async(id:string)=>{
    if(!await saveStoryboardSelection())return;
    setStoryboardNodeId(undefined);setMode('canvas');onFocusNode(id);
  };
  const closeStoryboardDetail=async()=>{
    if(!await saveStoryboardSelection())return;
    setStoryboardNodeId(undefined);setStoryboardTextExpanded(false);
  };
  const openStoryboardNode=async(node:CanvasNodeData)=>{
    if(node.id===storyboardNodeId&&director)return;
    if(!await saveStoryboardSelection())return;
    setStoryboardNodeId(node.id);setStoryboardTextExpanded(false);onClosePanel();
    const command=studioNodeCommand(node,true);
    if(command==="image"||command==="video")openDirector(command,node,"storyboard");
    else if(command==="editor")openDirector("script",node,"storyboard");
    else if(command==="edit-text")openDirector("text",node,"storyboard");
  };
  const editStoryboardNode=(node:CanvasNodeData)=>{
    if(node.metadata?.studio?.kind==="script"||node.metadata?.studio?.script)setEditorId(node.id);
    else setStoryboardTextExpanded(true);
  };
  const splitScript = useCallback((node: CanvasNodeData) => {
    openDirector("storyboard", node, mode==="storyboard"?"storyboard":"canvas");
  }, [openDirector,mode]);
  useEffect(() => {
    const listener = (event: Event) => {
      const { action: requestedAction, nodeId } = (event as CustomEvent<{ action: string; nodeId?: string }>).detail;
      // Keep the current draft visible if the native file picker is cancelled.
      if (requestedAction === 'upload-image' || requestedAction === 'upload-video') return;
      // A newly added Flow node is already in the document store before React updates these props.
      const node = nodesRef.current.find(n => n.id === nodeId)
        || useCanvasStore.getState().projects.find(p=>p.id===projectId)?.nodes.find(n=>n.id===nodeId);
      const action=requestedAction==="editor"&&node?studioNodeCommand(node,true)||requestedAction:requestedAction;
      panelSession.current++;setScriptPreviewId(undefined);
      if(["tasks","assistant","batch"].includes(action)){setTaskList(action==="tasks");setAssistantOpen(action==="assistant");setBatchOpen(action==="batch");}
      setDirector(false);setPickingReferences(false);setEditorId(undefined);setTemplateLibraryOpen(false);setSpeechOpen(false);
      if(action==="recreation"||action==="film-study"){
        setRecreationMode(action==="film-study"?"segments":node?.metadata?.studio?.recreation?.mode);
        const pending=node?.metadata?.studio?.kind==='recreation'&&studioGenerationPending(node)?node:node?.type===CanvasNodeType.Video?nodesRef.current.find(n=>studioGenerationPending(n)&&(n.metadata?.studio?.recreation?.mode==='segments')===(action==='film-study')&&n.metadata?.studio?.recreation?.sourceNodeId===node.id&&n.metadata.studio.recreation.sourceStorageKey===node.metadata?.storageKey):undefined;
        if(pending){setRecreationOpen(false);onFocusNode(pending.id);}else{setRecreationId(nodeId);setRecreationOpen(true);}onClosePanel();
      }
      else if(action==="tasks"){setTaskList(true);onClosePanel();}
      else if(action==="ip-library") openIpLibrary(nodeId?{kind:"node",nodeId}:{kind:"canvas"});
      else if(action==="assistant") {setAssistantNodeId(nodeId);setAssistantOpen(true);onClosePanel();}
      else if(action==="batch") {setBatchNodeId(nodeId);setBatchOpen(true);onClosePanel();}
      else if(action==="speech") openSpeech(node);
      else if(action==="lip") openLipSync(node);
      else if(action==="templates")openTemplates();
      else if(action==="library")openIpLibrary();
      else if(action==="commerce")openTemplates("commerce");
      else if(action==="digital")openTemplates("digital");
      else if(action==="work"||action==='editor'&&node?.metadata?.studio?.workDraft) {if(node?.metadata?.studio?.workDraft)setEpisodeFilter(node.metadata.studio.episodeNo??'all');setMode("work");onClosePanel();}
      else if(action==="script-preview"&&node?.metadata?.studio?.script){setScriptPreviewId(nodeId);onClosePanel();}
      else if (action === "editor") {
        if(node?.metadata?.status==='loading'&&node.metadata.studio?.request){setTaskList(true);onClosePanel();message.info('原剧本正在生成，请等待完成后编辑');return;}
        setEditorId(nodeId);onClosePanel();
      }
      else if (action === "split" && node) splitScript(node);
      else if (action in labels) openDirector(action as StudioOperation, node);
    };
    window.addEventListener("studio-command", listener);
    return () => window.removeEventListener("studio-command", listener);
  }, [openDirector, openSpeech, splitScript, onClosePanel,projectId]);

  const makeReferences = (ids: string[], role: StudioReference["role"]): StudioReference[] => ids.flatMap(id => {
    const node = nodesRef.current.find(n => n.id === id);
    return node ? studioNodeReferences(node, role) : [];
  });
  const submit = async () => {
    if (busy || !capabilities || (!prompt.trim() && !(operation==="video"&&nativeVideo&&nativeModeSpec?.promptRequired===false))) return;
    if(!capabilities.mock&&(operation==="image"||operation==="video")&&!chosenModel){message.error("所选模型已不可用，请重新选择模型");return;}
    if(durationIssue){message.error(durationIssue.message);return;}
    if(operation==="video"&&nativeVideo&&videoValidationError){message.error(videoValidationError);return;}
    if(operation==="video"&&legacyVideoError){message.error(legacyVideoError);return;}
    const origin = nodesRef.current.find(n => n.id === originId);
    if(studioGenerationPending(origin)){setTaskList(true);message.info("请等待或确认原任务，当前批次不会重复提交。");return;}
    const inputError=(operation==="image"||operation==="video")?studioLinkedInputError(originId,nodesRef.current,connectionsRef.current):undefined;
    if(inputError){message.error(inputError);return;}
    let requestPrompt=prompt.trim();
    try {if(operation==="script"&&!rewriteScope)requestPrompt=studioScriptInput(prompt,scriptMode,scriptSourceNodeId,nodesRef.current);
      // Storyboard keeps the document in its preview; the actual request snapshots it at submission.
      if(storyboardNodeId===originId&&origin?.metadata?.studio?.script&&(operation==="script"||operation==="storyboard"))requestPrompt=studioScriptPrompt(origin.metadata.studio.script,requestPrompt);
      requestPrompt=withStudioLinkedText(requestPrompt,originId,nodesRef.current,connectionsRef.current,operation==='script'&&scriptMode==='adapt'?scriptSourceNodeId:undefined);
      const promptLimit=promptMaxChars;
      const promptLength=nativeVideo||imagePromptMaxChars!=null?Array.from(requestPrompt).length:requestPrompt.length;
      if(promptLength>promptLimit)throw new Error(`创作要求与引用文本合计超过 ${promptLimit} 字，请减少引用内容`);}
    catch(e){message.error(e);return;}
    // The description says 16:9 / 4 秒 but the settings say otherwise: ask before a paid request, change nothing unasked.
    const conflict=operation==="image"||operation==="video"?studioSpecConflict(prompt,{aspectRatio:ratio,durationSec:operation==="video"?duration:undefined}):undefined;
    const conflictKey=`${originId}\n${ratio}\n${duration}\n${prompt}`;
    if(conflict&&!specConflictAnswered.current.has(conflictKey)) {
      const choice=await new Promise<"adopt"|"keep"|"cancel">(resolve=>setSpecConflict({conflict,resolve}));
      setSpecConflict(undefined);
      if(choice==="cancel")return;
      if(choice==="adopt"){
        if(conflict.aspectRatio)changeComposerRatio(conflict.aspectRatio.said);
        if(conflict.durationSec)setDuration(conflict.durationSec.said);
        message.info("已按描述改好设置，请确认费用后再生成。");
        return;
      }
      specConflictAnswered.current.add(conflictKey);
    }
    // Writing 图1 / 尾帧 in the text binds nothing. Ask before a paid request; never pick pictures or switch modes unasked.
    const intent=operation==="video"&&nativeVideo&&videoSettings?studioFrameIntent(requestPrompt,videoSettings,nativeModeSpec):undefined;
    const intentKey=`${originId}\n${videoDraft.mode}\n${requestPrompt}`;
    if(intent&&!frameIntentAnswered.current.has(intentKey)) {
      const choice=await new Promise<StudioFrameIntentChoice>(resolve=>setFrameIntent({intent,resolve}));
      setFrameIntent(undefined);
      if(choice==="cancel")return;
      if(choice==="bind"){bindFramesFor(intent);return;}
      frameIntentAnswered.current.add(intentKey);
    }
    setBusy(true);
    const submissionEpoch=epoch.current,session=panelSession.current;
    let posted=false;
    // Fill a new draft or storyboard shot; completed scripts keep their editable source.
    const reuseScriptDraft=(operation==="script"||operation==="storyboard")&&origin?.type===CanvasNodeType.Text&&origin.metadata?.studio?.kind==="script"&&!origin.metadata.studio.script;
    const target = operation==="text"&&origin?.type===CanvasNodeType.Text || reuseScriptDraft || operation === "image" && origin?.type===CanvasNodeType.Image || operation === "video" && origin?.type === CanvasNodeType.Video ? origin! : makeStudioNode(operation, origin);
    const usedReferenceIds=operation==="video"&&nativeVideo ? studioVideoSelectionIds(videoDraft,referenceIds):referenceIds;
    const references = makeReferences(usedReferenceIds, operation === "video" ? "frame" : "character");
    const requestEpisodeNo=operation==="image"||operation==="video"?studioNodeEpisode(origin):episodeNo;
    const selectedModel=chosenModel;
    const selectedCanvas=nativeVideo?.contract.tiers.find(t=>t.tier===videoDraft.tier)?.canvases.find(c=>c.aspectRatio===ratio);
    const request: StudioRunRequest = { clientRequestId: nanoid(), nodeId: target.id, operation, prompt: requestPrompt, references:operation==="video"&&nativeVideo?[]:references,video:operation==="video"&&nativeVideo?videoSettings:undefined, aspectRatio: ratio, durationSec: duration, count:operation==="image"?imageCount:operation==="video"?videoCount:undefined,model:capabilities.mock?undefined:(["text","script","storyboard"].includes(operation)?chosenTextModel?.endpointId:selectedModel?.endpointId),
      ...(operation==="text"?{textEdit:{content:origin?.metadata?.content||""},history:origin?.metadata?.studio?.textEditor?.turns}:{}),
      episodeNo:requestEpisodeNo,...(operation==="image"&&selectedImageSize?{size:selectedImageSize}:{}),...(operation==="script"||operation==="storyboard"?{settings}:{}),...(operation==="script"?{mode:scriptMode}:{}),maxCost:quote??undefined };
    const retainedTarget=retainStudioMediaVersions(target);
    const pending = { ...retainedTarget, metadata: { ...retainedTarget.metadata, prompt: request.prompt, ...(operation==="video"?{videoCount:String(videoCount)}:{}), ...(operation==="video"&&nativeVideo?{videoMode:videoDraft.mode,seconds:String(duration),vquality:videoDraft.tier,size:selectedCanvas?`${selectedCanvas.width}x${selectedCanvas.height}`:computeVideoSize(videoDraft.tier.replace(/p$/,""),ratio),model:encodeChannelModel(SERVER_CHANNEL_ID,selectedModel!.endpointId)}:{}),status: "loading" as const,
      studio: { ...target.metadata!.studio!, request, references, runId:undefined, upstreamChanged:false,...(operation==="script"?{scriptMode,scriptSourceNodeId:scriptMode==="adapt"?scriptSourceNodeId:undefined}:{}),settings:operation==="script"||operation==="storyboard"?settings:undefined,episodeNo:requestEpisodeNo,parentNodeId:target===origin?target.metadata?.studio?.parentNodeId:origin?.id,
        ...(operation==="script"&&rewriteScope?{rewriteScope,script:origin?.metadata?.studio?.script}:{}) } } };
    if (target === origin) patch(target.id, () => pending); else addNode(pending, origin);
    if(reuseScriptDraft&&origin?.metadata?.studio?.scriptSourceNodeId&&origin.metadata.studio.scriptSourceNodeId!==pending.metadata.studio.scriptSourceNodeId)
      setConnections(current=>current.filter(c=>c.toNodeId!==target.id||c.fromNodeId!==origin.metadata!.studio!.scriptSourceNodeId));
    // An uncertain response keeps every creation mode bound to its submitted target.
    setOriginId(target.id);
    if(operation==="video"&&nativeVideo)setConnections(current=>[...current.filter(c=>c.toNodeId!==target.id||!nodesRef.current.some(n=>n.id===c.fromNodeId&&[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].some(type=>type===n.type))),...usedReferenceIds.filter(id=>id!==target.id).map(id=>({id:nanoid(),fromNodeId:id,toNodeId:target.id}))]);
    try {
      await saveStudioDocument(projectId);
      if(epoch.current!==submissionEpoch)return;
      posted=true;
      const run = await submitStudioRun(projectId, request);
      if(epoch.current!==submissionEpoch)return;
      setNodes(nodes => applyStudioRunToDocument(nodes,connectionsRef.current,target.id,run)); if(panelSession.current===session){if(mode==="storyboard")setStoryboardNodeId(target.id);else setDirector(false);} void watch(run,target.id);
    } catch (e) {
      if(epoch.current!==submissionEpoch)return;
      message.error(e);
      // Preserve the request key so an uncertain network outcome can recover the original task.
      const rejected=!posted || e instanceof ApiError && (typeof e.status==="number"&&e.status>=400&&e.status<500&&e.status!==408 || e.code==="AI_NOT_CONFIGURED" || e.code==="PROMPT_NOT_CONFIGURED" || e.code==="ENDPOINT_NOT_ALLOWED" || e.code==="AI_TOKEN_PRICE_NOT_CONFIGURED" || e.code==="AI_TOKEN_PRICE_INVALID");
      patch(target.id,n => ({ ...n, metadata: { ...n.metadata,...studioErrorMetadata(e),status:rejected?"error":"loading", errorDetails: rejected?(e instanceof Error?e.message:"提交失败，请重试"):"任务未确认，请确认原任务，避免重复提交" } }));
    } finally { if(epoch.current===submissionEpoch)setBusy(false); }
  };
  const importScript = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    const session=panelSession.current;
    const origin=nodesRef.current.find(n=>n.id===originId);
    const prior=nodesRef.current.find(n=>n.id===pendingScriptImport.current);
    const reuseDraft=origin?.type===CanvasNodeType.Text&&origin.metadata?.studio?.kind==="script"&&!origin.metadata.studio.script;
    const node=prior?{...prior}:reuseDraft?{...origin!}:makeStudioNode("script",origin);
    const title=prompt.trim().split("\n")[0].slice(0,80);
    node.title=title;
    node.metadata={status:"success",content:prompt.trim(),studio:{kind:"script",parentNodeId:prior?.metadata?.studio?.parentNodeId||(node.id===origin?.id?origin.metadata?.studio?.parentNodeId:origin?.id),references:makeReferences(referenceIds,"character"),
      settings,scriptMode,scriptSourceNodeId:scriptMode==="adapt"?scriptSourceNodeId:undefined,script:{title,outline:"",characters:[],scenes:[],props:[],episodes:[{no:1,title:"正文",content:prompt.trim()}],shots:[]}}};
    if(prior||node.id===origin?.id)patch(node.id,()=>node);else addNode(node,origin);
    pendingScriptImport.current=node.id;
    try {await saveStudioDocument(projectId);pendingScriptImport.current=undefined;if(panelSession.current===session){setDirector(false);setEditorId(node.id);}}
    catch(e){message.error(e);}finally{setBusy(false);}
  };
  const retry = async (node: CanvasNodeData) => {
    if(node.metadata?.studio?.scriptEditor?.pending){setDirector(false);setEditorId(node.id);onClosePanel();return;}
    if(node.metadata?.studio?.lipSyncRequest){await sendNative(node,node.metadata.studio.lipSyncRequest,true);return;}
    if(node.metadata?.studio?.speechRequest){await sendNative(node,node.metadata.studio.speechRequest,true);return;}
    const request = node.metadata?.studio?.request;
    if (!request || busy) return;
    // A model the last failure (or the model list) proved gone is not tried again: open the composer to pick another,
    // with the prompt, references and settings kept. Three 640-credit holds on a retired model were three failures.
    const offered=node.type===CanvasNodeType.Video?models.video:node.type===CanvasNodeType.Image?models.image:undefined;
    if(node.metadata?.status==="error"&&(request.operation==="image"||request.operation==="video")&&studioUnusableModel(node,offered?.length?offered.map(m=>m.endpointId):undefined)){
      message.info("上次用的模型已不可用，请换一个模型再生成。");openDirector(request.operation,node);return;
    }
    setBusy(true);
    const submissionEpoch=epoch.current;
    let posted=false;
    const confirmingKnownRun=node.metadata?.status!=="error"&&!!node.metadata?.studio?.runId;
    const confirmingPendingRequest=studioGenerationPending(node);
    try {
      const next = node.metadata?.status === "error" ? { ...request, clientRequestId: nanoid() } : request;
      patch(node.id,n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails:undefined, studio: { ...n.metadata!.studio!, request: next,runId:next===request?n.metadata?.studio?.runId:undefined } } }));
      await saveStudioDocument(projectId);
      if(epoch.current!==submissionEpoch)return;
      posted=true;
      const originalRunId=next===request?node.metadata?.studio?.runId:undefined;
      const run = originalRunId?await readRun(originalRunId):await submitStudioRun(projectId,next);
      if(epoch.current!==submissionEpoch)return;
      patch(node.id,n=>applyStudioRun(n,run));void watch(run,node.id);
    } catch(e) {
      if(epoch.current!==submissionEpoch)return;
      // A failed local save cannot reject an earlier possibly accepted request.
      const rejected=!posted ? !confirmingPendingRequest : !confirmingKnownRun&&e instanceof ApiError && typeof e.status==="number"&&e.status>=400&&e.status<500&&e.status!==408;
      patch(node.id,n=>({...n,metadata:{...n.metadata,...studioErrorMetadata(e),status:rejected?"error":"loading",errorDetails:e instanceof Error?e.message:"任务未确认，请确认原任务"}}));
      message.error(e);
    } finally {if(epoch.current===submissionEpoch)setBusy(false);}
  };
  const sendNative = async (node:CanvasNodeData,request:StudioSpeechRequest|StudioLipSyncRequest,confirmingRequest=false) => {
    const lip="videoStorageKey" in request;
    if(busy)return;setBusy(true);const submissionEpoch=epoch.current,session=panelSession.current;let posted=false;
    const confirmingPendingRequest=confirmingRequest&&studioGenerationPending(node);
    const confirmingKnownRun=confirmingRequest&&node.metadata?.status!=="error"&&!!node.metadata?.studio?.runId;
    const next=node.metadata?.status==="error"?{...request,clientRequestId:nanoid()}:request;
    patch(node.id,n=>({...n,metadata:{...n.metadata,status:"loading",errorDetails:undefined,studio:{...n.metadata!.studio!,...(lip?{lipSyncRequest:next as StudioLipSyncRequest}:{speechRequest:next as StudioSpeechRequest}),runId:next===request?n.metadata?.studio?.runId:undefined}}}));
    try {
      await saveStudioDocument(projectId);if(epoch.current!==submissionEpoch)return;
      posted=true;const originalRunId=confirmingKnownRun?node.metadata?.studio?.runId:undefined;
      const run=originalRunId?await readRun(originalRunId):lip?await submitStudioLipSync(projectId,next as StudioLipSyncRequest):await submitStudioSpeech(projectId,next as StudioSpeechRequest);if(epoch.current!==submissionEpoch)return;
      patch(node.id,n=>applyStudioRun(n,run));if(panelSession.current===session){setSpeechOpen(false);setLipSyncOpen(false);}void watch(run,node.id);
    } catch(e) {
      if(epoch.current!==submissionEpoch)return;
      // Saving offline cannot reject an earlier possibly accepted speech/lip task.
      const rejected=!posted?!confirmingPendingRequest:!confirmingKnownRun&&e instanceof ApiError&&typeof e.status==="number"&&e.status>=400&&e.status<500&&e.status!==408;
      patch(node.id,n=>({...n,metadata:{...n.metadata,...studioErrorMetadata(e),status:rejected?"error":"loading",errorDetails:e instanceof Error?e.message:"生成任务未确认，请确认原任务"}}));
      message.error(e);
    } finally {if(epoch.current===submissionEpoch)setBusy(false);}
  };
  const createSpeech = async (value:Omit<StudioSpeechRequest,"clientRequestId"|"nodeId">) => {
    if(busy)return;
    const source=nodesRef.current.find(n=>n.id===speechOriginId);
    if(source&&studioGenerationPending(source)){if(source.metadata?.studio?.speechRequest)await sendNative(source,source.metadata.studio.speechRequest,true);return;}
    const reuse=source&&!source.metadata?.storageKey;
    const node:CanvasNodeData=reuse?{...source,title:`${value.speaker} 配音`}:{id:nanoid(),type:CanvasNodeType.Audio,title:`${value.speaker} 配音`,width:360,height:220,
      position:{x:source?source.position.x+source.width+90:100,y:source?.position.y||120},metadata:{studio:{kind:'audio',parentNodeId:source?.id,references:source?.metadata?.studio?.references}}};
    const request={...value,clientRequestId:nanoid(),nodeId:node.id};node.metadata={...node.metadata,status:'loading',studio:{kind:'audio',...node.metadata?.studio,speechRequest:request}};
    if(reuse)patch(node.id,()=>node);else addNode(node,source);setSpeechOriginId(node.id);await sendNative(node,request);
  };
  const createLipSync = async (value:Omit<StudioLipSyncRequest,"clientRequestId"|"nodeId">,videoId:string,audioId:string) => {
    if(busy)return;const video=nodesRef.current.find(n=>n.id===videoId),audio=nodesRef.current.find(n=>n.id===audioId);if(!video||!audio)return;
    const node=makeStudioNode("video",video);node.title=`${video.title} · 口型版`;
    const request={...value,clientRequestId:nanoid(),nodeId:node.id};
    node.metadata={status:"loading",studio:{kind:"shot",parentNodeId:video.id,episodeNo:studioNodeEpisode(video),
      references:video.metadata?.studio?.references,order:video.metadata?.studio?.order,includeInWork:false,lipSyncRequest:request}};
    addNode(node,video);setConnections(current=>[...current,{id:nanoid(),fromNodeId:audio.id,toNodeId:node.id}]);
    await sendNative(node,request);
  };
  const adopt = async () => {
    const node = nodesRef.current.find(n => n.id === adoptId);
    if (!node?.metadata?.storageKey || !adoptName.trim()) return;
    setBusy(true);
    try {
      await saveStudioDocument(projectId);
      const result = await adoptStudioImage(projectId,{ nodeId: node.id, storageKey: node.metadata.storageKey, name: adoptName.trim(), ipId: adoptIp,
        avatarId: adoptAvatar, intent:adoptIntent, description: node.metadata.prompt,assetRole:adoptIntent==="look"?adoptRole:"main" });
      patch(node.id,n => ({ ...n, metadata: { ...n.metadata, studio: { ...n.metadata?.studio, kind: "ip", adoption: result,libraryAssetRole:adoptIntent==="look"?adoptRole:"main" } } }));
      if (!node.metadata.studio?.adoption) addNode({ id: nanoid(), type: CanvasNodeType.Text, title: adoptName.trim(), width: 340, height: 240,
        position: { x: node.position.x, y: node.position.y - 310 }, metadata: { content: node.metadata.prompt, studio: { kind: "ip", adoption: result } } },node);
      setAdoptId(undefined); message.success(adoptIntent==="look"?"造型已加入人物档案":"IP 主形象已定稿"); await saveStudioDocument(projectId);
    } catch(e) {message.error(e);} finally {setBusy(false);}
  };
  const openAdopt = (node: CanvasNodeData) => {
    const source=node.metadata?.studio?.adoption || node.metadata?.studio?.references?.find(r=>r.avatarId);
    setAdoptId(node.id);setAdoptName(node.title);setAdoptIp(source?.ipId);setAdoptAvatar(source?.avatarId);setAdoptIntent(source?.lookId?"look":"main");setAdoptRole(node.metadata?.studio?.libraryAssetRole&&editableIpAssetRoles.includes(node.metadata.studio.libraryAssetRole)?node.metadata.studio.libraryAssetRole:"look");
    void listStudioIps().then(setIps).catch(e => message.error(e));void listStudioIpAssets().then(setIpAssets).catch(e=>message.error(e));onClosePanel();};
  /** 一键成片：按勾选的片段顺序拼。带着 edit（高级编辑的时间线）时按时间线合成，品牌文字和字幕已经在时间线里。返回是否已提交。 */
  const assemble = async (edit?: StudioEditTimeline): Promise<boolean> => {
    if(!edit&&workVoiceMissing){message.error('原配音已移出画布，请重新选择配音或保留原音轨');return false;}
    if(!edit&&packagingEnabled){try{parseStudioCaptions(captionText);if(!brand.trim()&&!workTitle.trim()&&!cta.trim()&&!captionText.trim())throw new Error("请填写品牌文字或字幕");}catch(e){message.error(e);return false;}}
    const editKeys=edit?[...new Set(edit.clips.map(c=>c.storageKey))]:[];
    const editAudioKeys=edit?new Set(edit.audios.map(a=>a.storageKey)):new Set<string>();
    const selectedClips = edit ? editKeys.flatMap(key=>nodes.find(n=>n.metadata?.storageKey===key&&n.metadata.studio?.kind!=='work')??[]) : clips.filter(n => studioClipIncluded(n,sourceClipIds));
    if ((edit?!editKeys.length:!selectedClips.length) || busy) return false;
    setBusy(true);const submissionEpoch=epoch.current;let posted=false; const target = makeStudioNode("assemble",selectedClips[selectedClips.length-1]);
    if(edit)target.title=`${workTitle.trim()||'成片'} · 高级编辑`;
    const request: StudioRunRequest={ clientRequestId:nanoid(),nodeId:target.id,operation:"assemble",prompt:edit?"按高级编辑的时间线合成":"按选定片段顺序合成",
      episodeNo:episodeFilter==="all"?undefined:episodeFilter,aspectRatio:workDraft.aspectRatio,
      ...(edit?{references:editKeys.map(storageKey=>({storageKey,role:"clip" as const})),edit}
        :{references:selectedClips.map(n => ({storageKey:n.metadata!.storageKey!,role:"clip" as const,ipId:n.metadata?.studio?.references?.find(r=>r.ipId)?.ipId})),
          ...((packagingEnabled||voiceoverKey)?{packaging:{...(packagingEnabled?{brand:brand.trim(),title:workTitle.trim(),cta:cta.trim(),captions:parseStudioCaptions(captionText)}:{}),voiceoverStorageKey:voiceoverKey}}:{})}) };
    target.metadata={...target.metadata,status:"loading",studio:{kind:"work",request,references:request.references,episodeNo:request.episodeNo}};addNode(target);
    const voiceNodes=edit?nodes.filter(n=>n.type===CanvasNodeType.Audio&&n.metadata?.storageKey&&editAudioKeys.has(n.metadata.storageKey))
      :voiceoverKey?nodes.filter(n=>n.type===CanvasNodeType.Audio&&n.metadata?.storageKey===voiceoverKey).slice(0,1):[];
    setConnections(current => [...current,...[...selectedClips,...voiceNodes].map(n=>({id:nanoid(),fromNodeId:n.id,toNodeId:target.id}))]);
    try {
      await saveStudioDocument(projectId);if(epoch.current!==submissionEpoch)return false;
      posted=true;const run=await submitStudioRun(projectId,request);if(epoch.current!==submissionEpoch)return true;
      patch(target.id,n=>applyStudioRun(n,run));void watch(run,target.id);
      return true;
    } catch(e){
      if(epoch.current!==submissionEpoch)return false;
      const rejected=!posted||e instanceof ApiError&&typeof e.status==="number"&&e.status>=400&&e.status<500&&e.status!==408;
      patch(target.id,n=>({...n,metadata:{...n.metadata,...studioErrorMetadata(e),status:rejected?"error":"loading",errorDetails:e instanceof Error?e.message:"合成提交未确认，请确认原任务"}}));
      message.error(e);
      return !rejected;
    } finally{if(epoch.current===submissionEpoch)setBusy(false);}
  };
  const moveClip = (from: number, to: number) => setNodes(current => reorderStudioClips(current, clips.map(n=>n.id), from, to));
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const layout=useLayoutMode();
  const advancedLibrary=useMemo(()=>nodes.filter(n=>(n.type===CanvasNodeType.Video||n.type===CanvasNodeType.Audio)&&n.metadata?.storageKey&&n.metadata.status==='success'&&n.metadata.studio?.kind!=='work'&&!n.metadata.studio?.workDraft),[nodes]);
  const saveAdvanced=(advanced:StudioAdvancedEdit)=>{changeWorkDraft({advanced});void saveStudioDocument(projectId).catch(e=>message.error(e));};
  const exportAdvanced=async(edit:StudioEditTimeline,advanced:StudioAdvancedEdit)=>{
    if(busy){message.error('还有一项操作在提交，稍等一下再导出');return false;}
    changeWorkDraft({advanced});return assemble(edit);
  };
  const dropAdvanced=()=>modal.confirm({title:'改回一键成片？',content:'高级编辑里的剪辑（裁剪、文字、音轨等）会丢掉，已经导出的作品不受影响。',okText:'改回一键成片',cancelText:'取消',okButtonProps:{danger:true},
    onOk:()=>changeWorkDraft({advanced:undefined})});
  const includeClip = (id: string, includeInWork: boolean) => patch(id,n => ({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,includeInWork}}}));
  const loadIpAssets = () => {
    setAssetsLoading(true);setAssetError("");
    void listStudioIpAssets().then(setIpAssets).catch(e=>setAssetError(e)).finally(()=>setAssetsLoading(false));
  };
  const openIpLibrary=(target:typeof libraryTarget={kind:"canvas"})=>{setLibraryTarget({...target,returnNodeId:target.nodeId||(target.kind==="director"?originId:activeComposerId)});setAssetPicker(true);loadIpAssets();if(target.kind==="canvas"||target.kind==="node")onClosePanel();};
  const restoreDirectorLibraryFocus=()=>{if(libraryTarget.kind==="director")setTimeout(()=>directorLibraryButton.current?.focus(),0);};
  const closeIpLibrary=()=>{setAssetPicker(false);if(libraryTarget.returnNodeId)onRestorePanel(libraryTarget.returnNodeId);restoreDirectorLibraryFocus();};
  // The homepage brief has gone out (or the thread already had messages): a refresh must not send it again.
  const autoSentDone=()=>{setEntryAutoSend(false);try{const url=new URL(window.location.href);if(url.searchParams.has("send")){url.searchParams.delete("send");window.history.replaceState(window.history.state,"",url.toString());}}catch{/* the thread being non-empty still stops a second send */}};
  useEffect(()=>{
    if(startOpened.current===projectId)return;
    const start=parseStudioEntry(new URLSearchParams(window.location.search).get("start"));
    if(!start||start==="blank")return;
    const source=[...nodesRef.current,...conversations].find(n=>n.metadata?.studioStart===start);
    // Existing work never gets reopened into a fresh creation flow on refresh.
    if(nodesRef.current.length && (nodesRef.current.length!==1||!source))return;
    startOpened.current=projectId;
    if(start==="image"||start==="video"||start==="script")openDirector(start,source);
    else if(start==="assistant"||start==="director"){setEntryAssistantMode(start==="director"?"director":"general");setEntryBrief(source?.metadata?.prompt||"");setEntryAutoSend(start==="assistant"&&new URLSearchParams(window.location.search).get("send")==="1"&&!!source?.metadata?.prompt);setAssistantNodeId(source?.id);setAssistantOpen(true);onClosePanel();}
    else if(start==="work"){setMode("work");onClosePanel();}
    else if(start==="commerce")openTemplates("commerce");
    else if(start==="speech")openSpeech(source);
    else if(start==="lip")openLipSync(selected);
    else if(start==="library")openIpLibrary();
    else if(start==="recreation"){setRecreationMode(undefined);setRecreationId(undefined);setRecreationOpen(true);onClosePanel();}
  },[projectId,openDirector,openSpeech,openIpLibrary,onClosePanel]);
  const finishIpImport=(nodeId:string)=>{
    setAssetPicker(false);if(libraryTarget.kind!=="director")setMode("canvas");
    if(libraryTarget.kind==="node"&&libraryTarget.nodeId)onRestorePanel(libraryTarget.nodeId);
    else if(libraryTarget.kind==="director") {
      if(operation==="video"&&nativeVideo)addNativeVideoReference(nodeId,CanvasNodeType.Image);
      else if(operation==="video"&&!nativeVideo)setReferenceIds([nodeId]);
      else setReferenceIds(ids=>[...new Set([...ids,nodeId])]);
      restoreDirectorLibraryFocus();
    }
    else onFocusNode(nodeId);
    message.success(libraryTarget.kind==="canvas"?"人物素材已添加到画布":"已引用选中的人物素材");
  };
  const importIpAsset = async (asset: StudioIpAsset,voice?:StudioVoiceProfile) => {
    const identity=JSON.stringify([asset.avatarId,asset.version,asset.lookId,asset.storageKey,voice?.voiceId,libraryTarget.kind,libraryTarget.nodeId]);
    const prior=pendingIpImport.current;
    if(prior?.identity===identity && nodesRef.current.some(n=>n.id===prior.nodeId)) {
      await saveStudioDocument(projectId);pendingIpImport.current=undefined;finishIpImport(prior.nodeId);return;
    }
    const {demoUrl:_demoUrl,...voiceSnapshot}=voice||{};
    const node: CanvasNodeData={id:nanoid(),type:CanvasNodeType.Image,title:asset.lookId&&asset.characterName?`${asset.characterName} · ${asset.name}`:asset.name,width:320,height:400,position:{x:100+nodes.length*30,y:120},
      metadata:{content:asset.url,storageKey:asset.storageKey,status:"success",studio:{kind:"ip",libraryAssetRole:ipAssetRole(asset),libraryCharacterName:asset.characterName||asset.name,...(asset.librarySource==="official"?{libraryCharacterId:asset.avatarId}:{}),...(voice?{voiceProfile:voiceSnapshot as StudioVoiceProfile}:{}),
        ...(asset.librarySource==="official"?{}:asset.ipId?{adoption:{ipId:asset.ipId,avatarId:asset.avatarId,version:asset.version,storageKey:asset.storageKey,lookId:asset.lookId}}:{references:[{avatarId:asset.avatarId,version:asset.version,storageKey:asset.storageKey,lookId:asset.lookId,role:"character" as const}]})}}};
    pendingIpImport.current={identity,nodeId:node.id};
    setNodes(current=>[...current,placeStudioNode(node,current)]);
    if(libraryTarget.kind==="node"&&libraryTarget.nodeId)setConnections(current=>[...current,{id:nanoid(),fromNodeId:node.id,toNodeId:libraryTarget.nodeId!}]);
    await saveStudioDocument(projectId);pendingIpImport.current=undefined;finishIpImport(node.id);
  };
  const selectedTakes = selected?.type===CanvasNodeType.Image?selected.metadata?.images:selected?.metadata?.videos;
  const unconfirmed = nodes.filter(n => n.metadata?.status==="loading" && (n.metadata.studio?.request||n.metadata.studio?.speechRequest||n.metadata.studio?.lipSyncRequest) && !runs.some(r=>r.id===n.metadata?.studio?.runId));
  // Models a failure on this canvas proved gone (VIDEO_MODEL_RETIRED …): never preselected again, shown disabled.
  const goneModels=new Set(nodes.flatMap(n=>{const m=studioUnusableModel(n);return m?[m]:[];}));
  const candidates=(operation==="video"?models.video:models.image).filter(m=>!goneModels.has(m.endpointId));
  const chosenModel=(operation!=="image"||capabilities?.imageModelMode!=="fixed")&&model&&candidates.some(m=>m.endpointId===model)?candidates.find(m=>m.endpointId===model):candidates.find(m=>m.isDefault) || candidates[0];
  // The node's last model cannot be used again: say which one the composer uses instead, before anything is paid.
  const lastRequestModel=(operation==="image"||operation==="video")?nodes.find(n=>n.id===originId)?.metadata?.studio?.request?.model:undefined;
  const replacedModelNotice=lastRequestModel&&chosenModel&&lastRequestModel!==chosenModel.endpointId&&model===lastRequestModel&&!candidates.some(m=>m.endpointId===lastRequestModel)
    ?`上次用的模型已不可用，这次改用「${chosenModel.name}」，费用以下方为准。`:undefined;
  const chosenTextModel=studioChosenTextModel(capabilities,model);
  const imagePromptMaxChars=operation==="image"?chosenModel?.capability?.imagePromptMaxChars??null:null;
  const imageBatchCounts=chosenModel?.capability?.imageBatchCounts?.length?chosenModel.capability.imageBatchCounts:legacyBatchCounts;
  const imageRatioChoices=["3:4","9:16","16:9","1:1"].map(value=>({value,label:imageRatioLabel(value)}));
  const allowedImageRatios=chosenModel?.capability?.imageRatios;
  const imageSizeOptions=chosenModel?.capability?.imageSizes?.filter(output=>output.aspectRatio===ratio)||[];
  const selectedImageSize=imageSizeOptions.some(output=>output.size===imageSize)?imageSize:imageSizeOptions[0]?.size;
  const imageRatioUnsupported=operation==="image"&&!!allowedImageRatios?.length&&!allowedImageRatios.includes(ratio);
  const imageRatioOptions:{value:string;label:string;disabled?:boolean}[]=allowedImageRatios?.length
    ? allowedImageRatios.map(value=>({value,label:imageRatioLabel(value)}))
    : imageRatioChoices;
  if(imageRatioUnsupported)imageRatioOptions.unshift({value:ratio,label:`${imageRatioLabel(ratio)}（当前模型不支持）`,disabled:true});
  const nativeVideo=operation==="video"&&!capabilities?.mock?nativeVideoModels.find(m=>m.endpointId===chosenModel?.endpointId):undefined;
  const videoBatchCounts=nativeVideo?.batchCounts?.length?nativeVideo.batchCounts:legacyBatchCounts;
  const promptMaxChars=nativeVideo?nativeVideo.contract.promptMaxChars:imagePromptMaxChars??16000;
  const promptTooLong=(nativeVideo||imagePromptMaxChars!=null?Array.from(prompt).length:prompt.length)>promptMaxChars;
  const nativeModeSpec=nativeVideo?.contract.modes.find(item=>item.mode===videoDraft.mode);
  useEffect(()=>{
    if(!nativeVideo||!director)return;
    setVideoDraft(current=>{
      const next=adaptStudioVideoReferences(nativeVideo,current,referenceIds,nodesRef.current,manualVideoModes.current.get(originId||''));
      const tier=nativeVideo.contract.tiers.some(item=>item.tier===next.tier)?next.tier:nativeVideo.contract.tiers[0]?.tier||next.tier;
      return tier===next.tier?next:{...next,tier};
    });
  },[director,originId,nativeVideo,referenceIds]);
  useEffect(()=>{
    if(operation==="image"&&chosenModel&&!imageBatchCounts.includes(imageCount))setImageCount(imageBatchCounts[0]);
  },[operation,imageCount,imageBatchCounts,chosenModel]);
  useEffect(()=>{
    if(operation==="video"&&chosenModel&&!videoBatchCounts.includes(videoCount))setVideoCount(videoBatchCounts[0]);
  },[operation,videoCount,videoBatchCounts,chosenModel]);
  // The same editable references drive both the graph and the composer; accepted requests remain immutable.
  useEffect(()=>{
    const node=nodesRef.current.find(n=>n.id===originId);
    const ownsComposer=node?.type===operation&&["image","video"].includes(operation)||node?.type===CanvasNodeType.Text&&node.metadata?.studio?.kind==="script"&&["script","storyboard"].includes(operation);
    if(!director||!node||!ownsComposer)return;
    const mediaIds=new Set(nodesRef.current.filter(n=>[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].includes(n.type as CanvasNodeType)).map(n=>n.id));
    const wanted=operation==="video"&&nativeVideo?studioVideoSelectionIds(videoDraft,referenceIds):referenceIds;
    const ids=[...new Set(wanted.filter(id=>id!==originId&&mediaIds.has(id)))];
    setConnections(current=>{
      const incoming=current.filter(c=>c.toNodeId===originId&&mediaIds.has(c.fromNodeId));
      if(incoming.length===ids.length&&incoming.every(c=>ids.includes(c.fromNodeId)))return current;
      return [...current.filter(c=>!incoming.includes(c)),...ids.map(id=>incoming.find(c=>c.fromNodeId===id)||{id:nanoid(),fromNodeId:id,toNodeId:originId!})];
    });
  },[director,originId,operation,referenceIds,videoDraft,nativeVideo,setConnections]);
  const videoPromptReferences=studioVideoPromptReferences(nodes,operation==="video"&&nativeVideo?studioVideoSelectionIds(videoDraft,referenceIds):referenceIds);
  const priorVideoReferences=useRef<{origin?:string;references:typeof videoPromptReferences}>(undefined);
  useEffect(()=>{
    if(!director||operation!=="video"){priorVideoReferences.current=undefined;return;}
    const prior=priorVideoReferences.current;
    if(prior?.origin===originId)setPrompt(value=>rebindStudioVideoMentions(value,prior.references,videoPromptReferences));
    priorVideoReferences.current={origin:originId,references:videoPromptReferences};
  },[director,operation,originId,JSON.stringify(videoPromptReferences.map(r=>[r.nodeId,r.label]))]);
  const removedVideoMention=operation==="video"&&prompt.includes('[已移除参考：');
  const legacyVideoError=operation==="video"&&!nativeVideo&&(referenceIds.length>1||referenceIds.some(id=>nodes.find(n=>n.id===id)?.type!==CanvasNodeType.Image))?"这个模型只支持一张首帧图，请移除多余素材或切回支持首尾帧 / 全能参考的模型":undefined;
  const imageIds=new Set(nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey).map(n=>n.id));
  const changeVideoDraft=(next:StudioVideoDraft)=>{
    const selection=changeStudioVideoDraft(videoDraft,next,referenceIds,imageIds);
    setVideoDraft(selection.draft);setReferenceIds(selection.referenceIds);
  };
  // Frame confirmation keeps the intended mode and opens the same compact reference picker used by the composer.
  const bindFramesFor=(intent:StudioFrameIntent)=>{
    const target=nativeVideo?studioFrameTarget(nativeVideo.contract.modes,intent)?.mode:undefined;
    if(target){manualVideoModes.current.set(originId||"",target.mode);if(target.mode!==videoDraft.mode)changeVideoDraft({...videoDraft,mode:target.mode});}
    // Unsupported frame intent still goes to model parameters without picking any images for the user.
    if(!target)setComposerSettingsOpen(true);
    focusFrameSlot.current=!!target; // open the picker after the dialog releases focus
  };
  const addNativeVideoReference=(nodeId:string,_type:CanvasNodeData["type"])=>{
    if(!nativeVideo)return;
    const ids=[...new Set([...referenceIds,nodeId])];
    if(!nativeVideo.contract.modes.some(spec=>studioVideoAcceptsReferences(spec,ids,nodesRef.current))){
      message.info("当前模型无法接收更多此类素材，请更换模型或移除一份参考");return;
    }
    setVideoDraft(draft=>adaptStudioVideoReferences(nativeVideo,draft,ids,nodesRef.current,manualVideoModes.current.get(originId||'')));
    setReferenceIds(ids);
  };
  const changeGenerationModel=(next:string)=>{
    const nextNative=nativeVideoModels.some(m=>m.endpointId===next)&&!capabilities?.mock;
    if(nativeVideo&&!nextNative)setReferenceIds(studioVideoSelectionIds(videoDraft,referenceIds));
    else if(!nativeVideo&&nextNative)setVideoDraft(studioVideoDraftFromReferences(videoDraft,referenceIds,imageIds));
    setModel(next);
  };
  const removeComposerReference=(id:string)=>{
    setReferenceIds(ids=>ids.filter(value=>value!==id));
    if(operation==="video"&&nativeVideo)setVideoDraft(draft=>({...draft,firstId:draft.firstId===id?undefined:draft.firstId,lastId:draft.lastId===id?undefined:draft.lastId}));
  };
  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("studio-reference-mode",{detail:{active:director&&pickingReferences,originId}}));
    return()=>{window.dispatchEvent(new CustomEvent("studio-reference-mode",{detail:{active:false}}));};
  },[director,pickingReferences,originId]);
  useEffect(()=>{
    const picked=(event:Event)=>{
      if(!director)return;const {nodeId,targetId}=(event as CustomEvent<{nodeId:string;targetId?:string}>).detail;
      if(targetId&&targetId!==originId)return;
      const node=nodesRef.current.find(n=>n.id===nodeId);
      if(targetId&&node?.type===CanvasNodeType.Text)return;
      if(!node?.metadata?.storageKey||nodeId===originId||!(operation==="video"?[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio]:[CanvasNodeType.Image]).includes(node.type as CanvasNodeType)){message.info("请选择可用的参考素材");return;}
      if(operation==="video"&&nativeVideo)addNativeVideoReference(nodeId,node.type);
      else if(operation==="video"&&!nativeVideo)setReferenceIds([nodeId]);
      else setReferenceIds(ids=>[...new Set([...ids,nodeId])]);
    };
    const removed=(event:Event)=>{
      const {nodeId,targetId}=(event as CustomEvent<{nodeId:string;targetId:string}>).detail;if(!director||targetId!==originId)return;
      setReferenceIds(ids=>ids.filter(id=>id!==nodeId));
      setVideoDraft(draft=>({...draft,firstId:draft.firstId===nodeId?undefined:draft.firstId,lastId:draft.lastId===nodeId?undefined:draft.lastId}));
    };
    const dismiss=()=>{setScriptPreviewId(undefined);if(pickingReferences)setPickingReferences(false);else if(director)void closeDirector();};
    window.addEventListener("studio-reference-selected",picked);window.addEventListener("studio-reference-removed",removed);window.addEventListener("studio-dismiss-composer",dismiss);
    return()=>{window.removeEventListener("studio-reference-selected",picked);window.removeEventListener("studio-reference-removed",removed);window.removeEventListener("studio-dismiss-composer",dismiss);};
  },[director,pickingReferences,originId,operation,nativeVideo,videoDraft,busy,directorSaving]);
  useEffect(()=>{
    const dismissForMenu=()=>{
      setContextMoreOpen(undefined);setScriptPreviewId(undefined);setPickingReferences(false);
      if(director)void closeDirector();
      if(speechOpen)void closeSpeech();
      if(!busy)setLipSyncOpen(false);
    };
    window.addEventListener('studio-node-context-menu',dismissForMenu);
    return()=>window.removeEventListener('studio-node-context-menu',dismissForMenu);
  },[director,speechOpen,busy,directorSaving,speechSaving]);
  const videoAssets=studioVideoSelectionIds(videoDraft,referenceIds)
    .map(id=>{const n=nodes.find(node=>node.id===id);return {storageKey:n?.metadata?.storageKey,mediaType:n?.type===CanvasNodeType.Video?"video" as const:n?.type===CanvasNodeType.Audio?"audio" as const:"image" as const};});
  let videoSettings:StudioRunRequest["video"],videoValidationError:string|undefined;
  if(nativeVideo)try {if(!nativeModeSpec)throw new Error("这个模型不支持所选视频模式，请重新选择");videoSettings=studioVideoSettings(videoDraft.mode,videoDraft.tier,videoAssets,videoDraft.seed,nativeModeSpec,!!videoDraft.keepPrompt&&nativeVideo.supportsPromptOptimization);videoValidationError=studioVideoError(nativeVideo,videoSettings,prompt,ratio,duration);}catch(e){videoValidationError=e instanceof Error?e.message:"请确认视频参考素材";}
  const durationOptions=capabilities?.mock?[8]:nativeVideo?[]:[5,6,8,10,12,15].filter(v=>(!chosenModel?.capability?.minDurationSec||v>=chosenModel.capability.minDurationSec)&&(!chosenModel?.capability?.maxDurationSec||v<=chosenModel.capability.maxDurationSec));
  // A duration the chosen model cannot do is shown with a one-press fix; it is never clamped behind the user's back
  // (4 秒 said in the conversation used to become the model's minimum or the first preset without a word).
  const durationIssue=operation==="video"?studioDurationIssue(duration,nativeVideo?{min:nativeVideo.contract.minSeconds,max:nativeVideo.contract.maxSeconds}:{options:durationOptions}):undefined;
  const videoUnitQuote=nativeVideo?studioVideoQuote(nativeVideo,videoSettings||{mode:videoDraft.mode,resolutionTier:videoDraft.tier},duration):chosenModel?chosenModel.creditCost*(chosenModel.billingUnit==="per_second"?duration:1):null;
  const quote=capabilities?.mock?0:operation==="image"?((chosenModel?.creditCost ?? capabilities?.imageCost ?? 0)*imageCount):operation==="video"?
    (videoUnitQuote==null?null:videoUnitQuote*videoCount):chosenTextModel?.tokenPricing?.maxCost;
  const episodeNumbers=[...new Set([...allShots,...allClips].map(n=>n.metadata?.studio?.episodeNo||n.metadata?.studio?.shot?.episodeNo||1))].sort((a,b)=>a-b);
  const usePlanStep=(step:StudioPlan["steps"][number])=>{
    // An assistant action creates a draft first; generation keeps the existing quote/confirmation flow.
    const existing=nodesRef.current.find(n=>n.id===step.resultNodeId);
    const upstream=nodesRef.current.find(n=>step.referenceNodeIds.includes(n.id));
    const node=existing||{...makeStudioNode(step.operation,upstream),title:step.title,metadata:{prompt:step.prompt,studio:{kind:["script","storyboard"].includes(step.operation)?"script" as const:"shot" as const}}};
    if(!existing) {
      addNode(node);
      setConnections(list=>[...list,...step.referenceNodeIds.filter(id=>id!==node.id&&nodesRef.current.some(n=>n.id===id)).map(id=>({id:nanoid(),fromNodeId:id,toNodeId:node.id}))]);
    }
    openDirector(step.operation,node);
    if(!existing) {
      setPrompt(step.prompt);
      const refs=step.referenceNodeIds.filter(id=>nodesRef.current.some(n=>n.id===id&&(step.operation==='video'?[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].includes(n.type as CanvasNodeType):n.type===CanvasNodeType.Image)&&n.metadata?.storageKey));
      setReferenceIds(refs);
      if(step.operation==='video'&&refs[0])setVideoDraft(draft=>({...draft,mode:refs.length===1&&nodesRef.current.find(n=>n.id===refs[0])?.type===CanvasNodeType.Image?'i2v':'universal_reference_video',firstId:refs[0]}));
    }
    setMissingPlanRefs(step.unresolvedReferences?.length?['参考素材']:[]);
    setAssistantOpen(false);
    return node.id;
  };
  const directorOrigin=nodes.find(n=>n.id===originId);
  // The last finished take of this video node, for what the vendor actually used (read-only, after acceptance).
  const composerRun=operation==="video"&&directorOrigin?.type===CanvasNodeType.Video?runs.find(r=>r.id===directorOrigin.metadata?.studio?.runId):undefined;
  const composerTake=studioComposerTake(composerRun,directorOrigin?.metadata?.primaryVideoId);
  const directorPending=studioGenerationPending(directorOrigin)?directorOrigin:undefined;
  const referenceComposer=["script","storyboard","image","video"].includes(operation);
  type ContextAction={key:string;node:ReactNode};
  // Actions belong to the open editor's node, never the mutable canvas selection (including right-click selection).
  const nodeActions=(nodeId?:string, excluded:string[]=[]):ReactNode=>{
    const selected=nodes.find(n=>n.id===nodeId);
    if(!selected)return null;
    const selectedStudio=selected.metadata?.studio;
    const selectedTakes=selected.type===CanvasNodeType.Image?selected.metadata?.images:selected.metadata?.videos;
    const contextItems:ContextAction[]=[];
    const meta=selected.metadata, studio=meta?.studio, add=(key:string,node:ReactNode)=>contextItems.push({key,node});
    if(meta?.status==="loading" && (studio?.request||studio?.speechRequest||studio?.lipSyncRequest) && !studio?.runId) add("confirm",<button type="button" disabled={busy} onClick={()=>void retry(selected)}>确认原任务</button>);
    // A failed image / video draft has one recovery here: the same request again, or — when its model is gone — the
    // composer to pick another. 「修改后重试」 is on the node itself; no second 「生成图片 / 生成视频」 next to it.
    const failedDraft=studioFailedWithoutMedia(selected);
    const offeredForSelected=selected.type===CanvasNodeType.Video?models.video:selected.type===CanvasNodeType.Image?models.image:undefined;
    const modelGone=!!studio?.request&&!!studioUnusableModel(selected,offeredForSelected?.length?offeredForSelected.map(m=>m.endpointId):undefined);
    if(meta?.status==="error" && modelGone && (studio?.request?.operation==="image"||studio?.request?.operation==="video"))
      add("retry",<button type="button" disabled={busy} onClick={()=>openDirector(studio!.request!.operation as "image"|"video",selected)}><RotateCcw size={15}/>换模型重试</button>);
    else if(meta?.status==="error" && (studio?.request||studio?.speechRequest||studio?.lipSyncRequest)) add("retry",<button title="AI 处理，会消耗积分" type="button" disabled={busy} onClick={()=>void retry(selected)}><StudioAiIcon/>重新生成</button>);
    if(selected.type===CanvasNodeType.Image){
      if(!failedDraft) add("image",<button data-studio-command="image" type="button" onClick={() => {
          openDirector("image",selected);
          if(selectedStudio?.libraryAssetRole==="sheet"){
            setPrompt("以选中的整张人物设定图为角色参考，生成一张单独的镜头画面。保持同一人物特征、服饰和视觉风格。只呈现一个场景，不要多视角拼版、说明文字或边框。请在此补充场景、动作与镜头角度。");setRatio("9:16");
          }
        }}><ImagePlus size={15}/>{selectedStudio?.libraryAssetRole==="sheet"?"生成镜头画面":meta?.storageKey?"继续改图":"生成图片"}</button>);
      if(meta?.storageKey){
        add("image-next",selectedStudio?.libraryAssetRole==="sheet"?<button type="button" onClick={()=>openDirector("image",selected)}><ImagePlus size={15}/>修改设定图</button>:<button type="button" onClick={() => openDirector("video",selected)}><Play size={15}/>引用生成视频</button>);
        add("adopt",<button type="button" onClick={() => openAdopt(selected)}><UserRound size={15}/>{studio?.adoption?.lookId?"另存人物素材":studio?.adoption?"更新主形象":"加入 IP"}</button>);
        if(studio?.adoption||studio?.references?.some(r=>r.avatarId)) add("script",<button type="button" onClick={() => openDirector("script",selected)}><BookOpen size={15}/>创作剧本</button>);
      }
    }
    if(selected.type===CanvasNodeType.Text&&studio?.script){
      add("editor",<button type="button" onClick={() => {setEditorId(selected.id);onClosePanel();}}><FileText size={15}/>打开编辑器</button>);
      add("split",<button type="button" onClick={() => splitScript(selected)}><Clapperboard size={15}/>生成分镜</button>);
      add("extract",<button type="button" onClick={()=>void openExtraction(selected.id)}><UserRound size={15}/>提取资产</button>);
    }
    if(selected.type===CanvasNodeType.Text&&!studio?.script&&!studio?.libraryReference) add("extract",<button type="button" onClick={()=>void openExtraction(selected.id)}><UserRound size={15}/>提取资产</button>);
    if(studio?.recreation?.report) add("film-study",<button type="button" onClick={()=>dispatchStudioCommand('film-study',selected.id)}><Clapperboard size={15}/>继续拉片</button>);
    if(studio?.kind==='recreation') add("recreation-doc",<button type="button" onClick={()=>dispatchStudioCommand('recreation',selected.id)}><FileText size={15}/>打开文档</button>);
    if(selected.type===CanvasNodeType.Video){
      if(studio?.kind!=="work"&&!failedDraft) add("video",<button data-studio-command="video" type="button" disabled={meta?.status==="loading"} onClick={()=>openDirector("video",selected)}>{meta?.storageKey?"重新生成视频":"生成视频"}</button>);
      add("upload-video",<button type="button" disabled={studioGenerationPending(selected)} onClick={()=>dispatchStudioCommand('upload-video',selected.id)}><Upload size={15}/>{meta?.storageKey?'替换视频':'上传视频'}</button>);
      if(meta?.storageKey){
        // 原第二排「专项创作」里的解析视频、口型同步，落在视频节点的「⋯」里。
        add("analyze",<button type="button" onClick={()=>void closeDirector().then(closed=>{if(closed)dispatchStudioCommand("recreation",selected.id);})}><FileText size={15}/>解析视频</button>);
        add("film",<button type="button" onClick={()=>dispatchStudioCommand("film-study",selected.id)}><Clapperboard size={15}/>拉片</button>);
        add("lip",<button type="button" onClick={()=>openLipSync(selected)}>口型同步</button>);
        // Frame extraction remains available in the editor overflow and the right-click menu.
        add("video-frames",<button type="button" disabled={meta.status==="loading"||studioGenerationPending(selected)} onClick={()=>dispatchStudioCommand("video-frames",selected.id)}><Camera size={15}/>抽帧</button>);
        add("work",<button type="button" disabled={!!meta.templateStepId&&studio?.templateAccepted!==true} onClick={() => setMode("work")}><Clapperboard size={15}/>加入成片</button>);
      }
    }
    if(studio?.lipSyncRequest&&meta?.storageKey&&!studio.lipSyncNormalized) add("lip-extract",<button type="button" disabled={busy} onClick={()=>void (async()=>{
        if(busy||!selected.metadata?.studio?.runId)return;setBusy(true);const token=epoch.current;
        try{const run=await extractStudioLipSync(projectId,selected.metadata.studio.runId);if(epoch.current!==token)return;
          patch(selected.id,n=>applyStudioRun(n,run));setRuns(current=>[run,...current.filter(r=>r.id!==run.id)]);await saveStudioDocument(projectId);
          message.success("口型片段已提取，原始对照视频保留在版本中；未再次扣积分");}
        catch(e){if(epoch.current===token)message.error(e);}
        finally{if(epoch.current===token)setBusy(false);}
      })()}>提取口型片段 · 免费</button>);
    if(studio?.lipSyncRequest&&meta?.storageKey&&studio.lipSyncNormalized&&!meta.primaryVideoId?.endsWith(":comparison")) add("lip-adopt",<button type="button" onClick={()=>{
        const original=selected.metadata?.studio?.parentNodeId;
        setNodes(current=>current.map(n=>n.id===selected.id||n.id===original?{...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,includeInWork:n.id===selected.id}}}:n));setMode("work");
      }}>采用口型片段</button>);
    if(selected.type===CanvasNodeType.Audio && studio?.speechRequest && studio?.runId && meta?.status==="success") add("voice",<button type="button" onClick={()=>setVoiceAdoptId(selected.id)}>设为人物声音</button>);
    if(selected.type===CanvasNodeType.Audio && meta?.content) add("download-audio",<button type="button" onClick={()=>void downloadMedia(selected.metadata!.content!,selected.title,selected.metadata?.mimeType,selected.metadata?.storageKey)}>下载配音</button>);
    if((selected.type===CanvasNodeType.Image||selected.type===CanvasNodeType.Video)&&meta?.storageKey&&meta.content) add("download",<button type="button" onClick={()=>void downloadMedia(selected.metadata!.content!,selected.title,selected.metadata?.mimeType,selected.metadata!.storageKey).catch(e=>message.error(e))}><Download size={15}/>{selected.type===CanvasNodeType.Image?"下载图片":"下载视频"}</button>);
    if(selectedTakes && selectedTakes.length>1){
      add("compare",<button type="button" onClick={()=>setTakePicker(selected.id)}>比较版本</button>);
      add("take",<Select aria-label="采用版本" value={selected.type===CanvasNodeType.Image?meta?.primaryImageId:meta?.primaryVideoId} getPopupContainer={containers}
        onChange={id => chooseTake(selected.id,id)} options={selectedTakes.map((v,i) => ({value:v.id,label:v.id.endsWith(":comparison")?"原始对照结果":`版本 ${i+1}${v.status==="loading"?" · 生成中":v.status==="error"?" · 失败":""}`,disabled:v.status!=="success"||!v.storageKey}))}/>);
    }
    const contextMore=contextItems.filter(a=>!excluded.includes(a.key));
    return <div className="studio-node-editor-actions" aria-label="节点编辑操作">
      <button type="button" className="studio-ask-assistant" title="把这个节点带进对话，让助手改它或接着做" onClick={()=>dispatchStudioCommand('assistant',selected.id)}><AiMark size={13}/>问助手</button>
      {!!contextMore.length&&<Popover trigger="click" placement="bottomLeft" arrow={false} open={contextMoreOpen===selected.id} onOpenChange={open=>setContextMoreOpen(open?selected.id:undefined)} getPopupContainer={containers}
        content={<div className="studio-context-more" role="group" aria-label="更多操作" onClick={e=>{if((e.target as HTMLElement).closest('button'))setContextMoreOpen(undefined);}}>{contextMore.map(a=><Fragment key={a.key}>{a.node}</Fragment>)}</div>}>
        <button type="button" className="studio-context-more-button" aria-label="更多操作" title="更多操作" aria-expanded={contextMoreOpen===selected.id}><Ellipsis size={18}/></button>
      </Popover>}</div>;
  };
  const storyboardNode=nodes.find(n=>n.id===storyboardNodeId);
  const changeComposerRatio=(next:string)=>{
    if(operation==="image"){
      const choices=chosenModel?.capability?.imageSizes?.filter(output=>output.aspectRatio===next)||[];
      const resolution=studioImageSizeLabel(selectedImageSize);
      setImageSize(choices.find(output=>studioImageSizeLabel(output.size)===resolution)?.size||choices[0]?.size);
    }
    setRatio(next);
  };
  const composerParameterContent=<div className="studio-director-form studio-parameter-form">
        {nativeVideo&&<StudioVideoControls section="settings" model={nativeVideo} draft={videoDraft} onChange={changeVideoDraft} nodes={nodes} referenceIds={referenceIds} onReferences={setReferenceIds}
          libraryButtonRef={directorLibraryButton} onLibrary={()=>openIpLibrary({kind:"director"})}/>}
        {operation==="image"&&imageSizeOptions.length>0&&<StudioChoiceGroup<string> label="清晰度" ariaLabel="图片输出尺寸" value={selectedImageSize} onChange={setImageSize} options={imageSizeOptions.map(output=>({value:output.size,label:studioImageSizeLabel(output.size),description:output.size.replace('x',' × ')}))}/>}

        {(operation==="script"||operation==="storyboard")&&<>
          {operation==="script"&&!rewriteScope&&<StudioChoiceGroup<"original"|"adapt"> label="创作模式" ariaLabel="剧本创作模式" value={scriptMode} onChange={setScriptMode} options={[{value:"original",label:"原创剧本"},{value:"adapt",label:"故事改编"}]}/>}
          {operation==="script"&&scriptMode==="adapt"&&!rewriteScope&&<><label>改编素材<Select aria-label="改编素材" allowClear value={scriptSourceNodeId} onChange={setScriptSourceNodeId} placeholder="在创作要求中粘贴故事，或选择画布正文" options={nodes.filter(n=>n.type===CanvasNodeType.Text&&n.id!==originId&&(n.metadata?.content||n.metadata?.studio?.script)).map(n=>({value:n.id,label:n.title}))}/></label><p>使用所选故事的当前正文。改编要求与人物版本会随本次请求保存。</p>{scriptSourceNodeId&&!nodes.some(n=>n.id===scriptSourceNodeId)&&<StudioErrorNotice error="原故事已移出画布，请重新选择素材。"/>}</>}
          <StudioScriptSettingsForm value={settings} onChange={setSettings}/>
          {operation==="storyboard"&&originId&&<label>拆分范围<Select aria-label="拆分分集" allowClear value={episodeNo} placeholder="全部分集" onChange={setEpisodeNo} options={(nodes.find(n=>n.id===originId)?.metadata?.studio?.script?.episodes||[]).map(e=>({value:e.no,label:`第 ${e.no} 集 · ${e.title}`}))}/></label>}</>}
        <StudioChoiceGroup<string> label="比例" ariaLabel="创作画幅" value={ratio} onChange={changeComposerRatio} ratios options={nativeVideo?nativeVideo.contract.tiers.find(t=>t.tier===videoDraft.tier)?.canvases.map(c=>({value:c.aspectRatio,label:c.aspectRatio,description:`${c.width} × ${c.height}`}))||[]:operation==="image"?imageRatioOptions.map(o=>({...o,label:o.value})):['9:16','16:9','1:1'].map(value=>({value,label:value}))}/>
        {imageRatioUnsupported&&<p role="status">当前模型不支持 {ratio}，请选择可用比例。</p>}
        {operation==="image"&&<StudioChoiceGroup<number> compact label="生成数量" ariaLabel="候选数量" value={imageCount} onChange={setImageCount} options={imageBatchCounts.map(value=>({value,label:`${value} 张`}))}/>}
        {operation==="video"&&<StudioChoiceGroup<number> compact label="生成数量" ariaLabel="视频候选数量" value={videoCount} onChange={setVideoCount} options={videoBatchCounts.map(value=>({value,label:`${value} 条`}))}/>}
        {operation==="video"&&<StudioDurationControl value={duration} onChange={setDuration} min={nativeVideo?.contract.minSeconds} max={nativeVideo?.contract.maxSeconds} options={durationOptions}/>}
        {nativeVideo&&<StudioVideoSeedControl seed={videoDraft.seed} max={nativeVideo.contract.seedMax} count={videoCount} onChange={seed=>changeVideoDraft({...videoDraft,seed})}/>}
        {nativeVideo&&videoValidationError&&<p role="status">{videoValidationError}</p>}
        {legacyVideoError&&<p role="status">{legacyVideoError}</p>}
        {operation==="script" && <Checkbox checked={pasteScript} onChange={e=>setPasteScript(e.target.checked)}>直接保存已有剧本</Checkbox>}
        {operation==="script"&&rewriteScope&&<p>此次只改写{rewriteScope.field==="outline"?"大纲":`第 ${rewriteScope.episodeNo} 集正文`}，结果生成新剧本，其他内容保留。</p>}


  </div>;
  // The duration problem sits next to the send button with its fix (ratio / mode / material problems already show
  // under the description); it must not hide inside the collapsed 「创作参数」 popover.
  const composerBlocker=operation==="video"&&!directorPending&&durationIssue
    ?<p className="studio-composer-validation studio-composer-blocker" role="alert">{durationIssue.message}<Button type="link" size="small" onClick={()=>setDuration(durationIssue.fix)}>改成 {durationIssue.fix} 秒</Button></p>:null;
  // §6.2: the frame actually sent (native: the first frame the mode takes; one-frame models: the first picture) and the
  // ratios the chosen model can make; a different shape is cropped around its centre by the server, never stretched.
  const cropFrame=operation!=="video"||directorPending?undefined:nativeVideo
    ?(videoSettings?.firstFrameKey?nodes.find(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey===videoSettings!.firstFrameKey):undefined)
    :nodes.find(n=>n.id===referenceIds[0]&&n.type===CanvasNodeType.Image);
  const cropRatios=nativeVideo?nativeVideo.contract.tiers.find(t=>t.tier===videoDraft.tier)?.canvases.map(c=>c.aspectRatio)||[]:['9:16','16:9','1:1'];
  const frameCropHint=cropFrame?<StudioFrameCropHint frame={cropFrame} ratio={ratio} ratios={cropRatios} onFix={changeComposerRatio}/>:null;
  const composerParameterSummary=operation==="image"?[ratio,studioImageSizeLabel(selectedImageSize),`${imageCount} 张`].filter(Boolean).join(' · '):operation==="video"?[ratio,nativeVideo?videoDraft.tier:undefined,`${duration}秒`,`${videoCount}条`,nativeVideo?.supportsPromptOptimization&&videoDraft.keepPrompt?"按原文":undefined].filter(Boolean).join(' · '):[settings.genre||'创作设定',`${settings.episodeCount||1} 集`,`${settings.episodeDurationSec||30} 秒`].join(' · ');
  const directorPanel = operation==="text" ? <StudioTextComposer actions={nodeActions(originId,["confirm"])} open={director} embedded={mode==="storyboard"} nodeId={originId} value={prompt} onChange={setPrompt}
    model={model} onModelChange={setModel} capabilities={capabilities} busy={busy||directorSaving}
    pending={directorPending?(directorPending.metadata?.studio?.runId?studioTaskLabel(directorPending.metadata.studio.task):busy?"正在提交修改要求…":"提交结果尚未确认，请确认原任务"):undefined}
    unknownTask={!!directorPending&&!directorPending.metadata?.studio?.runId&&!busy} onConfirm={()=>{if(directorPending)void retry(directorPending);}}
    billing={directorOrigin?.metadata?.studio?.textEditor?.turns.at(-1)?.billing}
    summary={directorOrigin?.metadata?.studio?.textEditor?.turns.at(-1)?.content} onSubmit={()=>void submit()} onClose={()=>void closeDirector()}/>
    : <StudioFloatingPanel title={labels[operation]} anchorId={originId} embedded={mode==="storyboard"} open={director&&(mode==="storyboard"||selectedNodeIds.size<=1)&&!(assetPicker&&libraryTarget.kind==="director")} onClose={() => void closeDirector()} closable={!directorSaving&&!busy} className={`studio-node-composer${operation==="image"||operation==="video"?" studio-media-composer":""}`} footer={<>      <div className="studio-generation-toolbar">
      {(operation==="video"||operation==="image")&&!capabilities?.mock&&<StudioModelPicker label="生成模型" value={chosenModel?.endpointId}
        disabled={busy||directorSaving||!!directorPending||candidates.length<=1||operation==="image"&&capabilities?.imageModelMode==="fixed"}
        onChange={changeGenerationModel} options={candidates.map(m=>({value:m.endpointId,label:m.name}))}/>}
      {(operation==="script"||operation==="storyboard")&&!pasteScript&&!capabilities?.mock&&<StudioModelPicker label="剧本模型"
        value={capabilities?.textModels?.find(m=>m.endpointId===model)?.endpointId||capabilities?.textModels?.find(m=>m.isDefault)?.endpointId||capabilities?.textModels?.[0]?.endpointId}
        disabled={busy||directorSaving||!!directorPending||capabilities?.textModelMode==="fixed"||!capabilities?.textModels?.length||capabilities.textModels.length<=1}
        onChange={setModel} options={(capabilities?.textModels||[]).map(m=>({value:m.endpointId,label:m.name}))}/>}
      {nativeVideo&&<StudioModelPicker label="视频模式" className="studio-mode-trigger" icon={<Clapperboard size={15}/>} value={videoDraft.mode}
        disabled={busy||directorSaving||!!directorPending} onChange={mode=>{manualVideoModes.current.set(originId||'',mode);setVideoDraft(draft=>({...draft,mode}));}}
        options={nativeVideo.contract.modes.map(spec=>({value:spec.mode,label:studioVideoModeName(spec),disabled:!studioVideoAcceptsReferences(spec,referenceIds,nodes),description:studioVideoAcceptsReferences(spec,referenceIds,nodes)?undefined:"不适用于当前素材"}))}/>}
      <StudioSettingsPopover label="创作参数" summary={composerParameterSummary} open={composerSettingsOpen} onOpenChange={setComposerSettingsOpen} disabled={busy||directorSaving||!!directorPending}>{composerParameterContent}</StudioSettingsPopover>
      </div>
{replacedModelNotice&&!directorPending&&<p className="studio-composer-validation" role="status">{replacedModelNotice}</p>}{composerBlocker}{frameCropHint}<div className="studio-creator-footer">{(!["text","script","storyboard"].includes(operation)||pasteScript&&operation==="script"||capabilities?.mock||quote==null)&&<p className="studio-quote" title={operation==="video"&&videoUnitQuote!=null?`${videoCount} 条，每条 ${videoUnitQuote} 积分`:undefined}>{pasteScript&&operation==="script"?"保存剧本 · 免费":capabilities?.mock?"测试响应 · 免费":["text","script","storyboard"].includes(operation)?(quote==null?"模型计费未配置":""):quote==null?"模型未配置，暂不可生成":`${quote} 积分`}</p>}{directorPending?<><p role="status">{directorPending.metadata?.studio?.runId?studioTaskLabel(directorPending.metadata.studio.task):busy?"正在提交任务，请稍候。":"提交结果尚未确认，请确认原任务。"}</p><Button type="primary" loading={busy} onClick={()=>{if(directorPending.metadata?.studio?.runId){setDirector(false);setTaskList(true);}else void retry(directorPending);}}>{directorPending.metadata?.studio?.runId?"查看原任务":"确认原任务"}</Button></>:<Button type="primary" className={operation==="image"||operation==="video"?"studio-composer-send":undefined} aria-label={operation==="image"||operation==="video"?labels[operation]:undefined} icon={operation==="image"||operation==="video"?<ArrowUp size={20}/>:pasteScript&&operation==="script"?undefined:<StudioAiIcon/>} title={pasteScript&&operation==="script"?undefined:"AI 处理，会消耗积分"} loading={busy||directorSaving} disabled={!(pasteScript&&operation==="script")&&quote==null||(!prompt.trim()&&!(operation==="video"&&nativeVideo&&nativeModeSpec?.promptRequired===false))||!capabilities||removedVideoMention||!!legacyVideoError||!!durationIssue||imageRatioUnsupported||!!nativeVideo&&!!videoValidationError||missingPlanRefs.length>0&&!referenceIds.length||promptTooLong||!capabilities.mock&&(operation==="image"||operation==="video")&&!chosenModel} onClick={() => void (pasteScript&&operation==="script"?importScript():submit())}>{operation==="image"||operation==="video"?null:pasteScript&&operation==="script"?"保存并编辑剧本":labels[operation]}</Button>}</div></>}>
      <div className="studio-composer-actions" role="group" aria-label="编辑操作">{nodeActions(originId,["confirm",...(operation==="image"&&directorOrigin?.metadata?.studio?.libraryAssetRole!=="sheet"?["image"]:[]),...(operation==="video"?["video"]:[])])}
      {referenceComposer&&<>{nativeVideo?<StudioReferencePicker openRequest={referencePickerRequest} nodes={nodes.filter(n=>n.id!==originId)} ids={referenceIds} onChange={ids=>setReferenceIds(ids)}
          accepts={ids=>nativeVideo.contract.modes.some(spec=>studioVideoAcceptsReferences(spec,ids,nodes))}
          picking={pickingReferences} onCanvasPick={()=>{setMode("canvas");setPickingReferences(value=>!value);}}/>:<Button aria-pressed={pickingReferences} onClick={()=>{setMode(pickingReferences&&storyboardNodeId?"storyboard":"canvas");setPickingReferences(value=>!value);}}>{pickingReferences?"完成参考选择":"参考"}</Button>}<Button ref={directorLibraryButton} onClick={()=>openIpLibrary({kind:"director"})}>IP 人物库</Button></>}
        {operation==="image"&&directorOrigin?.type===CanvasNodeType.Image&&<Button icon={<Upload size={16}/>} disabled={busy||!!directorPending} onClick={()=>dispatchStudioCommand('upload-image',originId)}>{directorOrigin.metadata?.storageKey?'替换图片':'上传图片'}</Button>}
      </div>
      <div className="studio-composer-references">
        {originId&&studioLinkedNodes(originId,nodes,connections).filter(n=>studioLinkedText(n).trim()||n.type===CanvasNodeType.Text&&n.metadata?.studio?.templateInput).map(n=><span className="studio-reference-chip" key={`text-${n.id}`}><FileText size={14}/><span title={studioLinkedText(n)}>{n.title}</span><button aria-label={`移除文本引用 ${n.title}`} onClick={()=>setConnections(edges=>edges.filter(c=>c.toNodeId!==originId||c.fromNodeId!==n.id))}><X size={14}/></button></span>)}
        {!nativeVideo&&(operation==="video"?studioVideoSelectionIds(videoDraft,referenceIds):referenceIds).map(id=>{const node=nodes.find(n=>n.id===id);return node?<span className="studio-reference-chip" key={id}>{node.type===CanvasNodeType.Image&&node.metadata?.content&&<SignedImage src={node.metadata.content} storageKey={node.metadata.storageKey} alt=""/>}<span>{operation==="video"?`${videoPromptReferences.find(r=>r.nodeId===id)?.label||"待补充"} · ${node.title}`:node.title}</span><button type="button" aria-label={`移除参考 ${node.title}`} onClick={()=>removeComposerReference(id)}><X size={13}/></button></span>:null;})}
        {nativeVideo&&<StudioReferenceStrip nodes={nodes} ids={studioVideoSelectionIds(videoDraft,referenceIds)} draft={videoDraft} spec={nativeModeSpec} onRemove={removeComposerReference}/>}
        {nativeModeSpec?.needsLastFrame&&videoDraft.firstId&&videoDraft.lastId&&<button type="button" className="studio-frame-swap" onClick={()=>changeVideoDraft({...videoDraft,firstId:videoDraft.lastId,lastId:videoDraft.firstId})}><ArrowLeftRight size={13}/>交换首尾帧</button>}
      </div>
      {pickingReferences&&<p className="studio-reference-pick-note" role="status">点击画布素材添加参考，完成后点击“完成参考选择”。</p>}
        {operation==="video"?<div className="studio-prompt-field"><span>创作要求</span><StudioMotionPrompt onLibraryRequest={openLibrary} videoModel={chosenModel?.endpointId} effectPreviews={nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey).map(n=>({storageKey:n.metadata!.storageKey!,name:n.title}))} ariaLabel="创作要求" references={videoPromptReferences} value={prompt} onChange={setPrompt} disabled={busy} className="studio-motion-drawer-editor" placeholder="描述画面或动作，输入 @ 引用素材"/></div>:<label>创作要求<StudioAssetMentionInput nodes={nodes} onLibraryRequest={openLibrary} onCanvasReference={id=>setReferenceIds(ids=>[...new Set([...ids,id])])} placeholder={operation==="script"?"描述故事、人物、风格和目标时长，也可以粘贴已有剧本":"描述希望生成的画面或动作"} value={prompt} onChange={setPrompt}/></label>}
      {imageRatioUnsupported&&<p className="studio-composer-validation" role="status">当前模型不支持 {ratio}，请打开创作参数选择可用比例。</p>}
      {promptTooLong&&<StudioErrorNotice error={`提示词最多 ${promptMaxChars} 字，请缩短内容。`}/>}
      {removedVideoMention&&<StudioErrorNotice error="提示词中有已移除的参考，请删除该标记或重新引用素材。"/>}
      <div className="studio-composer-inputs">

        {!nativeVideo&&<label>画布参考素材<Select mode="multiple" aria-label="参考素材" value={referenceIds} onChange={setReferenceIds} options={referenceOptions.map(n => ({value:n.id,label:n.title}))} placeholder="选择已在画布上的参考素材"/></label>}
        {!!missingPlanRefs.length&&<p role="status">方案中还需要补选：{missingPlanRefs.join("、")}。请在参考素材中确认实际图片。</p>}
        {!nativeVideo&&<div className="studio-ref-preview">{referenceIds.map(id => {const n=nodes.find(n => n.id===id);return n?<div key={id}>{n.type===CanvasNodeType.Image&&n.metadata?.content?<SignedImage src={n.metadata.content} storageKey={n.metadata.storageKey} alt={n.title}/>:<UserRound size={20}/>}<span>{n.title}</span></div>:null;})}</div>}
        {operation==="video" && !nativeVideo && <p>{nativeVideo?"按所选模式使用画布素材。":"当前模型支持文字或一张首帧图。"}{capabilities?.mock?"测试返回固定 8 秒的已有样例视频。":"提交后等待原任务结果，暂不支持中途停止。"}</p>}

        {(operation==="image"||operation==="video")&&!capabilities?.mock&&model&&!chosenModel&&<p role="status">所选模型已不可用，请重新选择模型。</p>}
</div>
      {nativeVideo&&<StudioVideoPromptNote model={nativeVideo} prompt={prompt} keepPrompt={!!videoDraft.keepPrompt} lastTake={composerTake}
        onShowRewrite={composerRun?()=>setRunDetail(composerRun):undefined}/>}
      {nativeVideo&&videoValidationError&&<p className="studio-composer-validation" role="status">{videoValidationError}</p>}{legacyVideoError&&<p className="studio-composer-validation" role="status">{legacyVideoError}</p>}
    </StudioFloatingPanel>;
  const activeRunCount=runs.filter(run=>run.status==="running").length;
  return <div className="studio-overlay">
    {/* 画布页改版（2026-10-19）：第二排工具条取消。视图切换居中悬浮；素材库 / 模板 / 专项创作进左栏；任务在左下角带角标；
        助手默认打开，关掉后右上角留一个 AI 圆钮。 */}
    {/* 设计稿 Main 画板：分段控件只有文字。 */}
    <nav className="studio-view-switch" aria-label="创作视图">{([["canvas","画布"],["storyboard","故事板"],["work","成片"]] as const).map(([value,label]) =>
      <button type="button" key={value} aria-pressed={mode===value} disabled={workSaving||directorSaving||busy} onClick={() => void switchView(value)}>{label}</button>)}</nav>
    {!assistantOpen&&<button type="button" className="studio-ai-orb" aria-label="打开创作助手" title="和助手说一句，它会把每一步放进画布" onClick={()=>dispatchStudioCommand("assistant",selected?.id)}><AiMark size={18}/></button>}
    <button type="button" className="studio-tasks-launch" onClick={()=>setTaskList(v=>!v)} aria-label={activeRunCount?`查看创作任务，${activeRunCount} 个进行中`:"查看创作任务"} title="创作任务" aria-pressed={taskList}><SquareCheckBig size={19} strokeWidth={1.75}/>{activeRunCount>0&&<span className="studio-tasks-count" aria-hidden="true">{activeRunCount}</span>}</button>
    {recreationOpen&&<StudioRecreation key={`${projectId}:${recreationId||'new'}`} projectId={projectId} initialNodeId={recreationId} nodes={nodes} capabilities={capabilities} setNodes={setNodes} setConnections={setConnections}
      actions={nodeActions(recreationId,["recreation-doc","analyze","film"])} mode={recreationMode} onClose={()=>setRecreationOpen(false)} onFocus={onFocusNode} onRun={(run,id)=>void watch(run,id)}/>}
    {capabilities?.mock && <div className="studio-test-note">测试响应 · 使用已有文字和媒体样例，不调用付费模型</div>}
    {capabilityError && <div className="studio-error-note"><StudioErrorNotice error={capabilityError}/><button type="button" onClick={loadCapabilities}>重新加载</button></div>}
    {/* Empty canvas: one guide card in the visible middle, with the assistant open or closed (docs/ip-studio-new-canvas-and-threads.md §2.3). */}
    {studioCanvasGuideVisible({nodeCount:nodes.length,mode,panelOpen:director||speechOpen||lipSyncOpen||recreationOpen||templateLibraryOpen||assetPicker||batchOpen||taskList||libraryQuery!==undefined||!!editorId||!!extractionId||!!textEditingNodeId})
      &&<StudioCanvasGuide assistantOpen={assistantOpen} onStartAssistant={()=>{setAssistantNodeId(undefined);setAssistantOpen(true);onClosePanel();}}/>}
    {/* Node actions live inside editors only; selection and right-click never mount an extra floating toolbar. */}
    {textEditingNodeId && mode==="canvas" && renderTextEditor?.(nodeActions(textEditingNodeId))}
    {mode!=="canvas" && <section className={`studio-focused-view${mode==="storyboard"?" studio-storyboard-view":""}`} aria-label={mode==="storyboard"?"故事板":"成片编辑器"}>
      <header><h2>{mode==="storyboard"?"故事板":"成片编辑器"}</h2><button type="button" aria-label="返回画布" disabled={workSaving||directorSaving||storyboardChanging||busy} onClick={() => void switchView("canvas")}><X size={18}/></button></header>
      {mode==="work"&&(episodeNumbers.length>1||episodeFilter!=="all")&&<div className="studio-episode-nav"><Select aria-label="当前分集" value={episodeFilter} onChange={setEpisodeFilter} options={[{value:"all",label:"全部分集"},...episodeNumbers.map(no=>({value:no,label:`第 ${no} 集`}))]}/></div>}
      {mode==="storyboard" ? <StudioStoryboard nodes={nodes} connections={connections}
        selectedNodeId={storyboardNodeId} changing={storyboardChanging||directorSaving||busy}
        composer={director&&originId===storyboardNodeId?directorPanel:(
          storyboardNode&&![CanvasNodeType.Text,CanvasNodeType.Image,CanvasNodeType.Video].includes(storyboardNode.type as CanvasNodeType)&&studioNodeCommand(storyboardNode,true)?<Button onClick={()=>dispatchStudioCommand(studioNodeCommand(storyboardNode,true)!,storyboardNode.id)}>打开{storyboardNode.type===CanvasNodeType.Audio?"配音编辑器":"节点工具"}</Button>:null)}
        onCloseDetail={()=>void closeStoryboardDetail()} onEditNode={editStoryboardNode}
        onAcceptText={node=>patch(node.id,n=>({...n,metadata:{...n.metadata,content:n.metadata?.studio?.textEditor?.proposal?.content||n.metadata?.content,
          studio:{...n.metadata!.studio!,textEditor:{...n.metadata!.studio!.textEditor!,proposal:undefined}}}}))}
        onOpenNode={node=>void openStoryboardNode(node)} onFocusNode={id=>void viewCanvasNode(id)}
        onCreateScript={()=>openDirector("script",undefined,"storyboard")} onSplitScript={splitScript}
        onBatch={()=>{setEpisodeFilter('all');setBatchNodeId(undefined);setBatchOpen(true);}}
        onShotChange={(id,changes)=>setNodes(current=>updateStudioStoryboardShot(current,connections,id,changes))}
        modelName={node=>{
          const id=node.metadata?.studio?.composerDraft?.model||node.metadata?.studio?.request?.model||node.metadata?.model;
          if(!id&&node.metadata?.content&&node.metadata.storageKey)return undefined;
          const available=node.type===CanvasNodeType.Image?models.image:node.type===CanvasNodeType.Video?models.video:capabilities?.textModels||[];
          return (id?available.find(m=>m.endpointId===id||m.endpointId===endpointIdFor(id)):available.find(m=>m.isDefault)||available[0])?.name;
        }}/>
      : <StudioWorkEditor nodes={nodes} connections={connections} clips={clips} multiEpisode={episodeNumbers.length>1}
          draft={workDraft} onDraftChange={changeWorkDraft} onIncludeClip={includeClip} onMoveClip={moveClip} works={work}
          renderNodeActions={node=>nodeActions(node.id,["work","download"])}
          busy={busy} locked={workSaving} mock={capabilities?.mock} onAssemble={() => void assemble()}
          onDownload={node => void downloadMedia(node.metadata!.content!,node.title,"video/mp4",node.metadata!.storageKey).catch(e => message.error(e))}
          onAddClips={() => setMode("canvas")} onCreateVideo={() => openDirector("video")} onOpenStoryboard={() => setMode("storyboard")}
          onMakeVoice={() => {setMode("canvas");openSpeech();}}
          advancedAvailable={layout!=="mobile"} onOpenAdvanced={() => setAdvancedOpen(true)} onDropAdvanced={dropAdvanced}/>}
    </section>}
    {mode!=="storyboard"&&directorPanel}
    {advancedOpen&&mode==="work"&&createPortal(<StudioAdvancedEditor projectId={projectId} title={workTitle.trim()||"成片"} draft={workDraft} library={advancedLibrary}
      clips={clips.filter(n=>studioClipIncluded(n,sourceClipIds))} voice={voiceoverKey?nodes.find(n=>n.type===CanvasNodeType.Audio&&n.metadata?.storageKey===voiceoverKey):undefined}
      onSave={saveAdvanced} onExport={exportAdvanced} onClose={()=>setAdvancedOpen(false)}/>,document.body)}
    <StudioFloatingPanel title="剧本" anchorId={scriptPreviewId} open={!!scriptPreviewId&&!editorId} onClose={()=>setScriptPreviewId(undefined)} footer={<Button type="primary" onClick={()=>{setEditorId(scriptPreviewId);}}>展开剧本编辑器</Button>}>
      {nodeActions(scriptPreviewId,["editor"])}
      {(()=>{const script=nodes.find(n=>n.id===scriptPreviewId)?.metadata?.studio?.script;return script?<div className="studio-script-inline"><h3>{script.title}</h3><p>{script.outline||script.episodes[0]?.content.slice(0,600)}</p><small>{script.episodes.length} 集 · 在画布中确认内容，展开后编辑大纲、人物与分集正文。</small></div>:null;})()}
    </StudioFloatingPanel>
    <Modal title="编辑文字" open={storyboardTextExpanded&&!!storyboardNode} onCancel={()=>{void saveStudioDocument(projectId).then(()=>setStoryboardTextExpanded(false)).catch(e=>message.error(e));}} footer={null} width="90vw" getContainer={containers}>
      <Input.TextArea aria-label="展开节点文字" rows={18} value={storyboardNode?.metadata?.content||""} onChange={e=>{if(storyboardNode)patch(storyboardNode.id,n=>({...n,metadata:{...n.metadata,content:e.target.value}}));}}/>
    </Modal>
    {editor&&<StudioScriptEditor key={`${projectId}:${editor.id}`} projectId={projectId} node={editor} capabilities={capabilities}
      onState={scriptEditor=>patch(editor.id,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,scriptEditor}}}))}
      onCommit={async(markdown,script)=>{
        setNodes(list=>{
          const current=list.find(n=>n.id===editor.id)?.metadata?.studio;
          const changed=markdown!==(current?.scriptMarkdown??(current?.script?scriptToMarkdown(current.script):''));
          return (changed?markStudioDescendants(list,editor.id):list).map(n=>n.id===editor.id?{...n,title:script.title,metadata:{...n.metadata,status:"success",content:script.episodes[0]?.content,studio:{...n.metadata!.studio!,script,scriptMarkdown:markdown,composerDraft:undefined}}}:n);
        });
        await saveStudioDocument(projectId);
      }}
      onClose={()=>{setEditorId(undefined);if(mode==="storyboard"){setStoryboardNodeId(editor.id);openDirector("script",nodesRef.current.find(n=>n.id===editor.id)||editor,"storyboard");}else setScriptPreviewId(editor.id);}}
      onExtract={()=>openExtraction(editor.id)}
      onStoryboard={no=>{const current=nodesRef.current.find(n=>n.id===editor.id);if(current){splitScript(current);setEpisodeNo(no);setEditorId(undefined);}}}/>}
    {extractionId&&nodes.find(n=>n.id===extractionId)&&<LibraryExtractionPanel projectId={projectId} node={nodes.find(n=>n.id===extractionId)!} onClose={()=>setExtractionId(undefined)} onTask={async assetExtraction=>{patch(extractionId,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,assetExtraction}}}));await saveStudioDocument(projectId);}} onUse={async asset=>{await insertLibrary([libraryObjectAsset(asset)]);}}/>}
    <LibraryReferencePicker open={libraryQuery!==undefined} query={libraryQuery||''} projectId={projectId} onClose={()=>{setLibraryQuery(undefined);libraryMention.current=undefined;}} onAssets={insertLibrary}/>
    <StudioTemplateLibrary open={templateLibraryOpen} scope={templateScope} nodes={nodes} onClose={()=>setTemplateLibraryOpen(false)}/>
    <StudioLipSync actions={nodeActions(lipOriginId,["lip"])} open={lipSyncOpen} onClose={()=>setLipSyncOpen(false)} projectId={projectId} nodes={nodes} initialNodeId={lipOriginId} busy={busy} onSubmit={createLipSync}/>
    <StudioSpeech actions={nodeActions(speechOriginId,["confirm"])} anchorId={speechOriginId} key={speechOriginId} initialDraft={speechOrigin?.metadata?.studio?.speechDraft} onDraft={updateSpeechDraft} initialVoiceId={speechOrigin?.metadata?.studio?.speechRequest?.voiceId||speechOrigin?.metadata?.studio?.voiceProfile?.voiceId} initialAvatarId={speechOrigin?.metadata?.studio?.speechRequest?.avatarId||speechOrigin?.metadata?.studio?.voiceProfile?.avatarId||speechOrigin?.metadata?.studio?.references?.find(r=>r.avatarId)?.avatarId||speechAvatarId} open={speechOpen} onClose={()=>void closeSpeech()} initialText={speechOrigin?.metadata?.studio?.speechRequest?.text||speechOrigin?.metadata?.prompt||""} busy={busy||speechSaving} pending={studioGenerationPending(speechOrigin)?{confirmed:!!speechOrigin?.metadata?.studio?.runId}:undefined} onConfirm={()=>{if(speechOrigin?.metadata?.studio?.runId){setSpeechOpen(false);setTaskList(true);}else if(speechOrigin)void retry(speechOrigin);}} onSubmit={createSpeech}/>
    {(()=>{const audio=nodes.find(n=>n.id===voiceAdoptId);return <StudioVoiceAdopt open={!!voiceAdoptId} projectId={projectId} runId={audio?.metadata?.studio?.runId} title={audio?.metadata?.studio?.voiceProfile?.name||audio?.title} initialAvatarId={audio?.metadata?.studio?.voiceProfile?.avatarId||audio?.metadata?.studio?.speechRequest?.avatarId} audioUrl={audio?.metadata?.content} audioKey={audio?.metadata?.storageKey} onClose={()=>setVoiceAdoptId(undefined)} onAdopt={async profile=>{
      if(!audio)return;const {demoUrl: _demoUrl,...snapshot}=profile;patch(audio.id,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,voiceProfile:snapshot}}}));await saveStudioDocument(projectId);message.success(`已保存 ${profile.name} · v${profile.version}；未再次扣积分`);
    }}/>;})()}
    <StudioAssistant projectId={projectId} conversations={conversations} setConversations={setConversations} nodes={nodes} setNodes={setNodes} setConnections={setConnections} connections={connections} capabilities={capabilities} open={assistantOpen} restorePending={executionRestorePending} initialNodeId={assistantNodeId} initialMode={entryAssistantMode} initialPrompt={[...nodes,...conversations].find(n=>n.id===assistantNodeId)?.metadata?.studioStart==='assistant'?entryBrief:undefined} autoSend={entryAutoSend} onAutoSent={autoSentDone} onClose={()=>{setAssistantOpen(false);setEntryAssistantMode(undefined);setEntryAutoSend(false);}} selectedIds={[...selectedNodeIds]} onUseStep={usePlanStep}/>
    <StudioBatchPanel projectId={projectId} nodes={nodes} shots={shots} setNodes={setNodes} setConnections={setConnections} models={models} capabilities={capabilities} open={batchOpen} initialNodeId={batchNodeId} onClose={()=>setBatchOpen(false)} ratio={ratio} episodeNo={episodeFilter==="all"?undefined:episodeFilter}/>
    <Modal title="比较并采用版本" open={!!takePicker} onCancel={()=>setTakePicker(undefined)} footer={null} width={720} getContainer={containers}>
      <div className="studio-take-grid">{(()=>{const node=nodes.find(n=>n.id===takePicker);const adopted=node?.type===CanvasNodeType.Image?node.metadata?.primaryImageId:node?.metadata?.primaryVideoId;return (node?.type===CanvasNodeType.Image?node.metadata?.images:node?.metadata?.videos)?.map((take,index)=><article className="studio-take" key={take.id}>
        <div className="studio-take-heading"><strong>版本 {index+1}</strong><span>{take.id===adopted?"已采用":take.status==="loading"?'queue' in take&&take.queue?`排队第 ${take.queue.position} 位`:"生成中":take.status==="error"?"生成失败":"可采用"}</span></div>
        {take.status==="success"&&take.storageKey?(node?.type===CanvasNodeType.Image?<SignedImage src={take.content} storageKey={take.storageKey} alt={`版本 ${index+1}`}/>:<SignedVideo src={take.content} storageKey={take.storageKey} controls preload="metadata"/>):<p className="studio-take-placeholder" role="status">{take.status==="error"?<StudioErrorNotice error={{code: take.errorCode || "STUDIO_VIDEO_FAILED",message: take.errorDetails || "本条生成失败，其他候选可继续采用。",logId: take.errorLogId,taskId: take.id}} once={`take:${take.id}`} autoReport={false}/>:'queue' in take&&take.queue?studioQueueNotice(take.queue):"正在生成，完成后可预览并采用。"}</p>}
        <Button disabled={take.status!=="success"||!take.storageKey||take.id===adopted} onClick={()=>{if(node)chooseTake(node.id,take.id);void saveStudioDocument(projectId).catch(e=>message.error(e));}}>{take.id===adopted?"已采用此版本":`采用版本 ${index+1}`}</Button></article>);})()}</div>

    </Modal>
    <Modal title="加入 IP 档案" open={!!adoptId} onCancel={() => !busy && setAdoptId(undefined)} onOk={() => void adopt()} confirmLoading={busy} okText="保存" cancelText="取消" getContainer={containers}>
      <div className="studio-director-form"><label>形象名称<Input aria-label="形象名称" value={adoptName} maxLength={128} onChange={e => setAdoptName(e.target.value)}/></label>
        <label>加入 IP<Select aria-label="加入 IP" allowClear placeholder="创建新 IP" value={adoptIp} onChange={id=>{setAdoptIp(id);setAdoptAvatar(undefined);}} options={ips.map(ip => ({value:ip.id,label:ip.name}))}/></label>
        <label>人物<Select aria-label="形象所属人物" allowClear placeholder="新建人物" value={adoptAvatar} onChange={setAdoptAvatar} options={ipAssets.filter(a=>a.librarySource!=="official"&&a.current&&(a.ipId||undefined)===adoptIp).map(a=>({value:a.avatarId,label:a.name}))}/></label>
        <label>保存方式<Select aria-label="形象保存方式" value={adoptIntent} onChange={setAdoptIntent} options={[{value:"main",label:"采用为主形象"},{value:"look",label:"保存为造型",disabled:!adoptAvatar}]}/></label>
        {adoptIntent==="look"&&<label>素材类别<Select aria-label="归档素材类别" value={adoptRole} onChange={setAdoptRole} options={editableIpAssetRoles.map(value=>({value,label:ipAssetRoles[value]}))}/></label>}
        <p>主形象更新会保留旧版本；造型归入所选人物，不改变正式主形象。</p></div>
    </Modal>
    {libraryTarget.kind==='canvas' ? <StudioMaterialLibrary projectId={projectId} open={assetPicker} assets={ipAssets} loading={assetsLoading} error={assetError} onClose={closeIpLibrary} onRefresh={loadIpAssets} onImport={importIpAsset} onAssets={insertLibrary} onAssetChange={asset=>setIpAssets(current=>current.map(a=>a.lookId===asset.lookId&&a.avatarId===asset.avatarId?asset:a))}/> : <StudioIpLibrary actionLabel="引用选中素材" open={assetPicker} assets={ipAssets} loading={assetsLoading} error={assetError} onClose={closeIpLibrary} onRefresh={loadIpAssets} onImport={importIpAsset} onAssetChange={asset=>setIpAssets(current=>current.map(a=>a.lookId===asset.lookId&&a.avatarId===asset.avatarId?asset:a))}/>}
    <StudioFloatingPanel title="创作任务" open={taskList} onClose={() => setTaskList(false)} width={480} utility className="studio-task-panel">
      <StudioTaskList runs={taskRuns} nodes={[...nodes,...conversations]} unconfirmed={unconfirmed} loading={tasksLoading} busy={busy}
        hasMore={taskMore} error={taskError} refreshErrors={refreshErrors}
        titleFor={run=>studioTaskPresentation(run,[...nodes,...conversations]).title}
        detailFor={run=>studioTaskPresentation(run,[...nodes,...conversations]).detail}
        onInput={setRunDetail} onLocate={node=>{setTaskList(false);if(node.metadata?.studio?.conversation){setAssistantNodeId(node.id);setAssistantOpen(true);}else{setMode("canvas");onFocusNode(node.id);}}}
        onRetry={node=>{if(node.metadata?.studio?.conversation){setAssistantNodeId(node.id);setAssistantOpen(true);}else void retry(node);}} onReload={()=>void loadTasks(taskPage)} onMore={()=>void loadTasks(taskPage+1)}
        onRefresh={async run=>{const token=epoch.current;const latest=await readRun(run.id);if(token!==epoch.current||!alive.current)return;
          setRuns(current=>current.map(item=>item.id===latest.id?latest:item));
          if(latest.status!=='running')terminalRuns.current.set(latest.id,latest);
          const target=nodesRef.current.find(node=>node.id===latest.nodeId&&node.metadata?.studio?.runId===latest.id);
          if(target)setNodes(nodes=>applyStudioRunToDocument(nodes,connectionsRef.current,target.id,latest));}}
        onCancel={run=>{const token=epoch.current;void cancelRun(run.id).then(result=>{
          if(epoch.current!==token||!alive.current)return;
          if(result.status!=='running')terminalRuns.current.set(result.id,result);
          setRuns(old=>old.map(r=>r.id===result.id?result:r));
          if(nodesRef.current.some(n=>n.id===result.nodeId&&n.metadata?.studio?.runId===result.id))
            setNodes(nodes=>applyStudioRunToDocument(nodes,connectionsRef.current,result.nodeId,result));
          message.info(result.status==='running'?"已请求停止创作":"已停止排队");
        }).catch(e=>message.error(e));}}/>
    </StudioFloatingPanel>
    <Modal title="本次创作输入" open={!!runDetail} onCancel={()=>setRunDetail(undefined)} footer={null} width={720} getContainer={containers}>
      {runDetail&&<div className="studio-director-form"><p>{runDetail.output.mock||Boolean((runDetail.inputs as unknown as {mock?:boolean}).mock)?"测试响应：使用已有样例，本次未向模型发送请求。":"此处保留提交时的输入快照。"}</p>
        {runDetail.kind==="studio-lip-sync"?<p>本次采用人物视频与配音驱动，具体素材和时长保存在下方快照中。</p>:<label>{runDetail.kind==="studio-audio"?"配音文案":"创作要求"}<Input.TextArea readOnly rows={8} value={(runDetail.inputs as unknown as {text?:string}).text||(runDetail.inputs as unknown as {prompt?:string}).prompt||""}/></label>}
        {runDetail.kind==="studio-video"&&<StudioVideoRewriteDetail run={runDetail}/>}
        <details><summary>查看参考、版本与参数快照</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify(runDetail.inputs,null,2)}</pre></details></div>}
    </Modal>
    <Modal open={!!specConflict} title="描述和设置不一致" getContainer={containers} width={440} onCancel={()=>specConflict?.resolve("cancel")}
      footer={[<Button key="keep" onClick={()=>specConflict?.resolve("keep")}>按当前设置生成</Button>,<Button key="adopt" type="primary" onClick={()=>specConflict?.resolve("adopt")}>按描述改设置</Button>]}>
      {specConflict&&<div className="studio-director-form"><p>描述里写的是 {studioSpecConflictText(specConflict.conflict).said}，现在的设置是 {studioSpecConflictText(specConflict.conflict).set}。</p>
        <p>模型按设置出片，描述里的规格不会自动生效。改设置后费用可能变化，会先给你看新的费用。</p></div>}
    </Modal>
    <StudioFrameIntentDialog intent={frameIntent?.intent} model={nativeVideo} getContainer={containers}
      onClosed={()=>{if(!focusFrameSlot.current)return;focusFrameSlot.current=false;
        setReferencePickerRequest(value=>value+1);}}
      canvasImages={nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey).length} onChoose={choice=>frameIntent?.resolve(choice)}/>
  </div>;
}
