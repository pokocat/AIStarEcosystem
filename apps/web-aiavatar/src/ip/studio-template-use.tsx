'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Input, Modal, Select, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ArrowRight, ImagePlus, Upload, UserRound, X } from 'lucide-react';
import type { IpTemplate, StudioIpAsset, StudioTemplateInput, StudioTemplatePlan, StudioTemplateValue, StudioTemplateVersion, StudioTemplateUseRequest, StudioAssetCatalog } from '@ai-star-eco/types';
import { readTemplateVersion, previewTemplate, instantiateTemplate } from '@/canvas-bridge/template-api';
import { listStudioIpAssets, studioAssetCatalog } from '@/canvas-bridge/studio-api';
import { StudioIpLibrary } from './studio-ip-library';
import { ipAssetRole, ipAssetRoles } from '@/canvas-bridge/studio-ip-library';
import { fetchModels, uploadImage, type IpModelOption } from '@/canvas-bridge/api';
import { studioOverlayContainer } from './studio-overlay';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { SignedImage } from '@/canvas-bridge/signed-image';

export function StudioTemplateUse({ template, nodes = [], onClose, onCreated }: { template: IpTemplate; nodes?: CanvasNodeData[]; onClose: () => void; onCreated: (id: string) => void }) {
  const formId = useId();
  const uploads = useRef<Record<string, HTMLInputElement | null>>({});
  const planElement = useRef<HTMLElement | null>(null);
  const [libraryInput, setLibraryInput] = useState<string>();
  const [assetError, setAssetError] = useState('');
  const [version, setVersion] = useState<StudioTemplateVersion>();
  const [assets, setAssets] = useState<StudioIpAsset[]>([]), [models, setModels] = useState<IpModelOption[]>([]);
  const [products, setProducts] = useState<StudioAssetCatalog['products']>([]), [previews, setPreviews] = useState<Record<string, { url?: string; name: string }>>({});
  const [videoModels, setVideoModels] = useState<IpModelOption[]>([]), [videoModel, setVideoModel] = useState<string>();
  const [values, setValues] = useState<Record<string, StudioTemplateValue>>({}), [model, setModel] = useState<string>();
  const [name, setName] = useState(template.name), [plan, setPlan] = useState<StudioTemplatePlan>();
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [uploadingInput, setUploadingInput] = useState<string>();
  const [loadRevision, setLoadRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    // Optional saved products supplement uploads and canvas references; catalog failure must not block templates.
    void studioAssetCatalog().then(c => { if (active) setProducts(c.products); }).catch(() => {});
    Promise.all([readTemplateVersion(template.versionId!), listStudioIpAssets(), fetchModels()]).then(([v, a, m]) => {
      if (!active) return;
      setVersion(v); setAssets(a); setModels(m.image); setModel(m.image.find(x => x.isDefault)?.endpointId ?? m.image[0]?.endpointId);
      setVideoModels(m.video); setVideoModel(m.video.find(x => x.isDefault)?.endpointId ?? m.video[0]?.endpointId);
      setValues(Object.fromEntries(v.recipe.inputs.filter(i => i.type === 'text' || i.type === 'option').map(i => [i.id, { text: i.defaultValue ?? '' }])));
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : '模板加载失败'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [template.versionId, loadRevision]);
  useEffect(() => {
    // Reveal the quote before switching the footer to free creation, including short desktop windows.
    const body = planElement.current?.closest('.ant-modal-body');
    if (plan && body) body.scrollTop = body.scrollHeight;
  }, [plan]);
  const change = (id: string, value: StudioTemplateValue) => { setValues(old => ({ ...old, [id]: value })); setPlan(undefined); setError(''); };
  const images = nodes.filter(n => n.type === CanvasNodeType.Image && n.metadata?.storageKey && n.metadata.status === 'success');
  const availableImages = [...images.map(n => ({ storageKey: n.metadata!.storageKey!, url: n.metadata?.content, name: `画布 · ${n.title}` })), ...products.filter(p => p.storageKey && !images.some(n => n.metadata?.storageKey === p.storageKey)).map(p => ({ storageKey: p.storageKey!, url: p.url, name: `商品 · ${p.name}` }))];
  const hasImage = version?.recipe.steps.some(s => s.operation === 'image'), hasVideo = version?.recipe.steps.some(s => s.operation === 'video');
  const missing = version?.recipe.inputs.filter(i => i.required && (i.type === 'text' || i.type === 'option' ? !values[i.id]?.text?.trim() : !values[i.id]?.reference?.storageKey)) ?? [];
  const canPreview = !!name.trim() && missing.length === 0 && (!hasImage || !!model) && (!hasVideo || !!videoModel);
  const request = (): StudioTemplateUseRequest => ({ versionId: version!.id, name: name.trim(), inputs: values, model: hasImage ? model : undefined, videoModel: hasVideo ? videoModel : undefined });
  const preview = async () => { if (!canPreview) return; setBusy(true); setError(''); try { setPlan(await previewTemplate(request())); } catch (e) { setError(e instanceof Error ? e.message : '制作计划加载失败'); } finally { setBusy(false); } };
  const create = async () => { setBusy(true); setError(''); try { const result = await instantiateTemplate(request()); onCreated(result.project.id); } catch (e) { setError(e instanceof Error ? e.message : '套用失败'); setPlan(undefined); } finally { setBusy(false); } };
  const inputRole = (id: string) => version?.recipe.inputs.find(i => i.id === id)?.type === 'character' ? 'character' as const : 'frame' as const;
  const upload = async (id: string, file: File) => {
    setBusy(true); setUploadingInput(id); setError('');
    try { const result = await uploadImage(file, file.name); setPreviews(old => ({ ...old, [result.key]: { url: result.url, name: file.name } })); change(id, { reference: { storageKey: result.key, role: inputRole(id) } }); }
    catch (e) { setError(e instanceof Error ? e.message : '图片上传失败，请重试'); }
    finally { setBusy(false); setUploadingInput(undefined); }
  };
  const fieldLabel = (input: StudioTemplateInput) => {
    const content = <>{input.label}{input.required && <span className="studio-template-required">必填</span>}</>;
    return input.type === 'character' || input.type === 'image'
      ? <div id={`${formId}-${input.id}-label`} className="studio-template-field-label">{content}</div>
      : <label id={`${formId}-${input.id}-label`} htmlFor={`${formId}-${input.id}`} className="studio-template-field-label">{content}</label>;
  };
  const referenceField = (input: StudioTemplateInput) => {
    const key = values[input.id]?.reference?.storageKey;
    const asset = assets.find(a => a.storageKey === key), image = availableImages.find(a => a.storageKey === key), uploaded = key ? previews[key] : undefined;
    const selectedName = asset ? asset.characterName || asset.name : image?.name || uploaded?.name || '已选择参考图片';
    return <section key={input.id} className="studio-template-reference" aria-labelledby={`${formId}-${input.id}-label`}>
      {fieldLabel(input)}
      <div className={`studio-template-media${key ? ' is-selected' : ''}`}>
        {key ? <figure><SignedImage src={asset?.url || image?.url || uploaded?.url} storageKey={key} alt={input.label} /><figcaption title={selectedName}><span>{selectedName}</span>{asset && <small>{ipAssetRoles[ipAssetRole(asset)]} · v{asset.version}</small>}</figcaption></figure> : <div className="studio-template-media-empty">{input.type === 'character' ? <UserRound size={26} /> : <ImagePlus size={26} />}<span>{input.type === 'character' ? '选择人物或上传参考图' : '上传图片，或选择已有素材'}</span><small>JPG / PNG</small></div>}
        {key && <Button className="studio-template-remove" type="text" icon={<X size={14} />} aria-label={`${input.label}移除参考`} title="移除参考" disabled={busy} onClick={() => change(input.id, {})} />}
        {uploadingInput === input.id && <div className="studio-template-uploading" role="status"><Spin size="small" /><span>正在上传…</span></div>}
      </div>
      <div className="studio-template-reference-actions">
        {input.type === 'character' && <Button aria-label={`${input.label}选择 IP`} disabled={busy} icon={<UserRound size={15} />} onClick={() => setLibraryInput(input.id)}>{key ? '更换人物' : 'IP 人物库'}</Button>}
        {input.type === 'image' && availableImages.length > 0 && <Select id={`${formId}-${input.id}`} aria-label={`已有${input.label}`} disabled={busy} placeholder="选择已有素材" value={availableImages.some(a => a.storageKey === key) ? key : undefined} options={availableImages.map(a => ({ value: a.storageKey, label: a.name }))} onChange={storageKey => change(input.id, { reference: { storageKey, role: 'frame' } })} />}
        <Button aria-label={`${input.label}上传图片`} disabled={busy} icon={<Upload size={15} />} onClick={() => uploads.current[input.id]?.click()}>{key ? '替换图片' : '上传图片'}</Button>
        <input ref={el => { uploads.current[input.id] = el; }} aria-label={`上传${input.label}`} className="studio-template-file-input" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(input.id, f); e.target.value = ''; }} />
      </div>
    </section>;
  };
  const references = version?.recipe.inputs.filter(i => i.type === 'character' || i.type === 'image') ?? [];
  const otherInputs = version?.recipe.inputs.filter(i => i.type === 'text' || i.type === 'option') ?? [];
  // A local provider also covers the picker on /projects, outside CanvasHost's theme.
  // Selecting a person replaces the form so two modal portals never cover one another.
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#495b91', borderRadius: 9, fontFamily: 'var(--ip-font-sans)' } }}>
    <Modal open={!libraryInput} getContainer={studioOverlayContainer} className="studio-template-use-modal" centered title={<div className="studio-template-use-title"><h2>套用「{template.name}」</h2><p>{version ? `${version.visibility === 'personal' ? '个人模板' : '官方模板'} · v${version.version} · ` : ''}用自己的素材创建画布</p></div>} onCancel={onClose} footer={version ? <div className="studio-template-use-footer"><p>{plan ? '创建免费，生成时确认费用' : missing.length ? `还需补充 ${missing.length} 项必填内容` : '先查看制作计划和预计积分'}</p><div><Button onClick={onClose} disabled={busy}>取消</Button>{plan ? <Button aria-label="免费创建画布" className="studio-template-use-primary" loading={busy} disabled={!canPreview} onClick={() => void create()}>免费创建画布<ArrowRight size={15} /></Button> : <Button aria-label="预览制作计划" className="studio-template-use-primary" onClick={() => void preview()} loading={busy} disabled={!canPreview}>预览制作计划<ArrowRight size={15} /></Button>}</div></div> : null} width={820} mask={{ closable: !busy }} keyboard={!busy} closable={!busy}>
      {loading ? <div className="studio-template-load-state" role="status"><Spin /><span>正在读取模板…</span></div> : <div className="studio-template-use-form">
        {version && <>
          <label className="studio-template-name">画布名称<Input aria-label="画布名称" value={name} disabled={busy} onChange={e => { setName(e.target.value); setPlan(undefined); }} maxLength={128} /></label>
          {references.length > 0 && <div className="studio-template-references">{references.map(referenceField)}</div>}
          {otherInputs.map(input => <div className="studio-template-text-field" key={input.id}>{fieldLabel(input)}{input.type === 'text' ? <Input.TextArea id={`${formId}-${input.id}`} aria-label={input.label} disabled={busy} value={values[input.id]?.text ?? ''} onChange={e => change(input.id, { text: e.target.value })} maxLength={2000} placeholder={`填写${input.label}`} autoSize={{ minRows: 3, maxRows: 6 }} /> : <Select id={`${formId}-${input.id}`} aria-label={input.label} disabled={busy} placeholder="请选择" value={values[input.id]?.text || undefined} options={input.options?.map(x => ({ value: x, label: x }))} onChange={text => change(input.id, { text })} />}</div>)}
          {(hasImage || hasVideo) && <div className="studio-template-models">
            {hasImage && <label>图片模型<Select aria-label="模板图片模型" disabled={busy} value={model} placeholder="暂无可用图片模型" options={models.map(m => ({ value: m.endpointId, label: m.name }))} onChange={id => { setModel(id); setPlan(undefined); }} /></label>}
            {hasVideo && <label>视频模型<Select aria-label="模板视频模型" disabled={busy} value={videoModel} placeholder="暂无可用视频模型" options={videoModels.map(m => ({ value: m.endpointId, label: m.name }))} onChange={id => { setVideoModel(id); setPlan(undefined); }} /></label>}
          </div>}
          {((hasImage && !model) || (hasVideo && !videoModel)) && <Alert type="warning" title="当前模板需要的模型尚未配置，请稍后再试。" showIcon />}
          {plan && <section ref={planElement} className="studio-template-use-plan" aria-label="制作计划">
            <h3>{plan.imageCount} 张图片{plan.videoCount ? ` · ${plan.videoCount} 条视频` : ''} · 制作预计 {plan.totalCost} 积分</h3>
            <ol>{plan.steps.map(s => <li key={s.id}><span>{s.title}</span><small>{s.cost} 积分{s.requiresAdoption ? ' · 采用后继续' : ''}{s.status === 'waiting_adoption' ? ' · 等待上游采用' : s.dependsOn.length ? ' · 依赖前序图片' : ''}</small></li>)}</ol>
            <p>创建画布不会开始生成。进入画布后，确认费用再制作。</p>
          </section>}
        </>}
        {error && <Alert type="error" title={error} showIcon />}
        {!version && error && <Button onClick={() => setLoadRevision(v => v + 1)}>重新加载模板</Button>}
      </div>}
    </Modal>
    <StudioIpLibrary open={!!libraryInput} actionLabel="引用选中素材" assets={assets} loading={false} error={assetError} onClose={() => setLibraryInput(undefined)} onRefresh={() => { setAssetError(''); void listStudioIpAssets().then(setAssets).catch(e => setAssetError(e.message || '人物库加载失败')); }} onAssetChange={asset => setAssets(old => old.map(a => a.lookId === asset.lookId && a.avatarId === asset.avatarId ? asset : a))} onImport={async a => { if (!libraryInput) return; change(libraryInput, { reference: { ...(a.librarySource === 'official' ? {} : { ipId: a.ipId, avatarId: a.avatarId, version: a.version, lookId: a.lookId }), storageKey: a.storageKey, role: inputRole(libraryInput) } }); setLibraryInput(undefined); }} />
  </ConfigProvider>;
}
