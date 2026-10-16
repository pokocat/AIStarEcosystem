import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { decodeMediaFrames } from './vendor/media-local/file-frames.js';
import { visualBoundaries } from './vendor/media-local/files.js';
import { runProcess } from './vendor/media-local/process.js';

if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node.js 22+ required');
const revision='dc2b7a8f31b1ef1443a79ca448548d69e3ceb6a0';
if(process.argv.includes('--version')) {
  process.stdout.write(JSON.stringify({engine:'hypit-media',revision})+'\n');
} else {
  const [sourceArg,directoryArg,durationArg]=process.argv.slice(2);
  if(!sourceArg||!directoryArg||!durationArg)throw new Error('Expected source, temporary directory and duration');
  const source=resolve(sourceArg),directory=resolve(directoryArg),duration=Number(durationArg);
  if(!Number.isFinite(duration)||duration<=0||duration>60)throw new Error('Unsupported duration');
  await mkdir(directory,{recursive:true});
  const proxy=join(directory,'proxy.mp4');
  // Keep the source frame clock; reduce image allocation before Hypit's continuous native decode.
  await runProcess('ffmpeg',['-nostdin','-v','error','-copyts','-start_at_zero','-threads','2','-i',source,'-map','0:v:0','-an','-vf','scale=640:640:force_original_aspect_ratio=decrease','-fps_mode','passthrough','-frames:v','18001','-c:v','libx264','-preset','veryfast','-crf','18','-threads','2','-y',proxy],180_000);
  const frames=await decodeMediaFrames(proxy,0,duration+.001,join(directory,'native'));
  if(frames.length>18000)throw new Error('Too many source frames');
  const sampleRate=Math.min(120,Math.max(24,Math.round(frames.length/duration)));
  const candidates=await visualBoundaries(proxy,sampleRate,.08);
  await writeFile(join(directory,'hypit-evidence.json'),JSON.stringify({engine:'hypit-media',revision,frames,candidates,sampleRate}));
}
