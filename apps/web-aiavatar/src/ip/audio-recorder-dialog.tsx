"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { Mic, RotateCcw, Square } from 'lucide-react';
import { microphoneError, recordingAudioSupported, recordingFile, RECORDING_MAX_SECONDS, RECORDING_STOP_AFTER_SECONDS, RECORDING_SUGGESTED_SECONDS } from '@/canvas-bridge/recording-audio';
import { readingCue, RECORDING_LINES, type ReadingPace } from '@/canvas-bridge/recording-guide';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { studioOverlayContainer } from './studio-overlay';

type Props = { open: boolean; onClose: () => void; onSave: (file: File) => Promise<void> };
type Stage = 'idle' | 'requesting' | 'countdown' | 'recording' | 'processing' | 'ready' | 'saving';
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function AudioRecorderDialog({ open, ...props }: Props) {
  // Closing unmounts the session, releasing microphones even while permission is pending.
  return open ? <RecordingSession {...props}/> : null;
}

function RecordingSession({ onClose, onSave }: Omit<Props, 'open'>) {
  const [stage, setStage] = useState<Stage>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [pace, setPace] = useState<ReadingPace>('natural');
  const seconds = Math.floor(elapsed);
  const [file, setFile] = useState<File>();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useStudioErrorState();
  const live = useRef(true), pending = useRef(false), attempt = useRef(0);
  const stream = useRef<MediaStream | undefined>(undefined);
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const preview = useRef('');
  const customName = useRef(false), defaultName = useRef('');
  const audio = useRef<HTMLAudioElement>(null);

  const release = () => {
    clearInterval(timer.current);
    const rec = recorder.current;
    if (rec) {
      rec.onstop = null; rec.ondataavailable = null; rec.onerror = null;
      if (rec.state !== 'inactive') rec.stop();
    }
    recorder.current = undefined;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = undefined;
  };
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; attempt.current++; release(); if (preview.current) URL.revokeObjectURL(preview.current); };
  }, []);

  const start = async () => {
    if (pending.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || !recordingAudioSupported()) {
      setError('当前浏览器无法录音，请使用 HTTPS 网站和支持录音的浏览器，也可以上传音频文件。');
      return;
    }
    pending.current = true;
    const id = ++attempt.current;
    setError(''); setStage('requesting'); setElapsed(0); setCountdown(3); setFile(undefined);
    audio.current?.pause();
    if (preview.current) { URL.revokeObjectURL(preview.current); preview.current = ''; setUrl(''); }
    try {
      // Same microphone + format negotiation as the original voice studio; no cloning or model call.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current || id !== attempt.current) { mic.getTracks().forEach(track => track.stop()); return; }
      stream.current = mic;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(mic, mimeType ? { mimeType } : undefined);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onerror = () => { release(); if (live.current) { pending.current = false; setStage('idle'); setError('录音中断了，请检查麦克风后重新录制。'); } };
      rec.onstop = async () => {
        release();
        if (!live.current || id !== attempt.current) return;
        setStage('processing');
        try {
          if (!chunks.length) throw new Error('没有录到声音，请重新录制。');
          const result = await recordingFile(new Blob(chunks, { type: rec.mimeType || chunks[0].type }));
          if (!live.current || id !== attempt.current) return;
          preview.current = URL.createObjectURL(result);
          defaultName.current = result.name.replace(/\.wav$/i, '');
          setFile(result); if (!customName.current) setName(defaultName.current);
          setUrl(preview.current); setStage('ready');
        } catch (e) { if (live.current && id === attempt.current) { setStage('idle'); setError(e); } }
        finally { pending.current = false; }
      };
      // Prepare silently before capture; neither the countdown nor a guide voice enters the recording.
      setStage('countdown');
      const prepared = performance.now();
      timer.current = setInterval(() => {
        const remaining = 3 - (performance.now() - prepared) / 1000;
        setCountdown(Math.max(0, Math.ceil(remaining)));
        if (remaining > 0) return;
        clearInterval(timer.current);
        try {
          rec.start(250); setStage('recording');
          const started = performance.now();
          timer.current = setInterval(() => {
            const duration = Math.min(RECORDING_MAX_SECONDS, (performance.now() - started) / 1000);
            setElapsed(duration);
            if (duration >= RECORDING_MAX_SECONDS && rec.state === 'recording') rec.stop();
          }, 100);
        } catch (e) { release(); pending.current = false; setStage('idle'); setError(microphoneError(e)); }
      }, 100);
    } catch (e) { release(); pending.current = false; if (live.current && id === attempt.current) { setStage('idle'); setError(microphoneError(e)); } }
  };

  const save = async () => {
    if (pending.current || !file || !name.trim()) return;
    pending.current = true; setStage('saving'); setError(''); audio.current?.pause();
    try {
      await onSave(new File([file], `${name.trim().replace(/\.wav$/i, '')}.wav`, { type: 'audio/wav' }));
      if (live.current) onClose();
    } catch (e) { if (live.current) { setStage('ready'); setError(e); } }
    finally { pending.current = false; }
  };
  const working = stage === 'requesting' || stage === 'processing' || stage === 'saving' || stage === 'countdown';
  const recorded = stage === 'ready' || stage === 'saving';
  const cue = readingCue(stage === 'recording' ? elapsed : 0, pace);
  const status = stage === 'recording' ? cue.current < 0 && elapsed >= 12 ? '读完后可以结束录音' : '跟着高亮往下读' : stage === 'countdown' ? '准备开口' : stage === 'requesting' ? '请允许浏览器使用麦克风' : stage === 'processing' ? '正在整理录音…' : recorded ? '录好了，先听一听' : '准备好后，开始录音';
  let character = 0;

  return <Modal open title="录制声音" footer={null} width={480} getContainer={studioOverlayContainer} className="asset-recorder-modal"
    onCancel={() => stage !== 'saving' && onClose()} closable={stage !== 'saving'} mask={{ closable: false }} keyboard={stage !== 'saving'}>
    <div className="asset-recorder">
      <p className="asset-recorder-intro">找个安静的地方，用平时说话的声音读一遍。只录你自己或已获授权的声音，不放背景音乐。</p>
      {!recorded && <>
        <div className="asset-recorder-reading-heading"><strong>跟着读，约 15 秒</strong><div className="asset-recorder-pace" role="group" aria-label="朗读节奏">
          {([{ value: 'natural', label: '自然' }, { value: 'relaxed', label: '稍慢' }] as const).map(p => <button key={p.value} type="button" aria-pressed={pace === p.value} disabled={stage !== 'idle'} onClick={() => setPace(p.value)}>{p.label}</button>)}
        </div></div>
        <div className={`asset-recorder-script${stage === 'recording' ? ' is-reading' : ''}`} aria-label="朗读示例">
          {RECORDING_LINES.map(line => <p key={line} aria-label={line}>{Array.from(line).map(c => {
            const index = character++;
            return <span key={index} aria-hidden="true" className={index < cue.read ? 'is-read' : index === cue.current ? 'is-current' : undefined}>{c}</span>;
          })}</p>)}
          {stage === 'countdown' && <div className="asset-recorder-countdown" role="status" aria-label={`倒数 ${countdown}`}><strong>{countdown}</strong><span>准备开口</span></div>}
        </div>
        <p className="asset-recorder-pace-note">高亮提示朗读节奏，逗号处稍停，句号处换气。14.9 秒自动结束。</p>
      </>}
      <div className={`asset-recorder-state${stage === 'recording' ? ' is-recording' : ''}`}>
        <p role="status">{stage === 'recording' && <i aria-hidden="true"/>}{status}</p>
        <span className="asset-recorder-time" aria-label={`录音时长 ${clock(seconds)}`}>{clock(seconds)}{!recorded && <small> · 建议 {RECORDING_SUGGESTED_SECONDS} 秒</small>}</span>
      </div>
      {recorded && <div className="asset-recorder-preview">
        <audio ref={audio} src={url} controls preload="metadata" aria-label="试听录音"/>
        <label htmlFor="asset-recording-name">录音名称</label>
        <Input id="asset-recording-name" value={name} maxLength={80} disabled={stage === 'saving'} onChange={e => { customName.current = e.target.value !== defaultName.current; setName(e.target.value); }}/>
      </div>}
      {error && <p className="assets-form-error"><StudioErrorNotice error={error}/></p>}
      <div className="asset-recorder-actions">
        <Button disabled={stage === 'saving'} onClick={onClose}>取消</Button>
        {recorded ? <><Button icon={<RotateCcw size={15}/>} disabled={working} onClick={() => void start()}>重录</Button>
          <Button type="primary" loading={stage === 'saving'} disabled={!name.trim()} onClick={() => void save()}>保存到资产库</Button></>
          : stage === 'recording' ? <>{elapsed < RECORDING_STOP_AFTER_SECONDS && <span className="asset-recorder-stop-hint" role="status">再读 {Math.ceil(RECORDING_STOP_AFTER_SECONDS - elapsed)} 秒</span>}<Button type="primary" icon={<Square size={14}/>} disabled={elapsed < RECORDING_STOP_AFTER_SECONDS} onClick={() => { if (elapsed >= RECORDING_STOP_AFTER_SECONDS && recorder.current?.state === 'recording') recorder.current.stop(); }}>结束录音</Button></>
          : <Button type="primary" icon={<Mic size={15}/>} loading={working} onClick={() => void start()}>{stage === 'processing' ? '正在整理' : stage === 'countdown' ? '准备录音' : '开始录音'}</Button>}
      </div>
    </div>
  </Modal>;
}
