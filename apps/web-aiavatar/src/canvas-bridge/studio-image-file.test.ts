import { afterEach, expect, test, vi } from 'vitest';
import { prepareStudioImageUpload, STUDIO_IMAGE_UPLOAD_MAX_BYTES, validateStudioImageUpload } from './studio-image-file';
import { imageKind, imageHeaderSize, fitUploadImage, prepareImageFormData, prepareImageForUpload } from '@ai-star-eco/api-client/image-upload';

afterEach(() => vi.unstubAllGlobals());
function jpeg(bytes = 100, width = 100, height = 100) { const b = new Uint8Array(bytes); b.set([255,216,255,192,0,17,8,0,100,0,100,3,1,17,0,2,17,0,3,17,0]); const v=new DataView(b.buffer);v.setUint16(7,height);v.setUint16(9,width);return b; }
function renderer(mime: string, sizes: number[], width = 6000, height = 4000, bytes = 9 * 1024 * 1024, transparent = true) {
  const close = vi.fn(), drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, getImageData: () => ({ data: new Uint8ClampedArray([0,0,0,transparent?0:255]) }) }),
    toBlob: vi.fn((callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(sizes.shift() ?? 100)], { type }))) };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  vi.stubGlobal('document', { createElement: () => canvas });
  const content = mime === 'image/png' ? new Uint8Array(bytes) : jpeg(bytes,width,height);
  if (mime === 'image/png') content.set([137,80,78,71,13,10,26,10]);
  const file = new File([content], mime === 'image/png' ? '透明原图.png' : '相机照片.jpg', { type: mime, lastModified: 123 });
  return { file, canvas, close, drawImage };
}

test('a compliant JPEG is unchanged without decoding or removing metadata', async () => {
  const decode = vi.fn(); vi.stubGlobal('createImageBitmap', decode);
  const file = new File([jpeg()], '相机照片.jpg', { type: 'image/jpeg' });
  expect(imageHeaderSize(jpeg())).toEqual({width:100,height:100});
  expect(await prepareStudioImageUpload(file)).toBe(file);
  expect(decode).not.toHaveBeenCalled();
});
test('a 48MP camera original is resized on the device, with a bounded output canvas', async () => {
  const { file, canvas, close, drawImage } = renderer('image/jpeg', [1024], 8064, 6048);
  const result = await prepareStudioImageUpload(file);
  expect(result.size).toBeLessThanOrEqual(STUDIO_IMAGE_UPLOAD_MAX_BYTES);
  expect(result.name).toBe(file.name); expect(result.type).toBe('image/jpeg'); expect(result.lastModified).toBe(123);
  const [, , , w,h]=drawImage.mock.calls[0];
  expect(w*h).toBeLessThanOrEqual(16_000_000); expect(Math.abs(w/h-4/3)).toBeLessThan(.001);
  expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
});
test('PNG keeps transparency; an oversized encode is retried at a smaller resolution', async () => {
  const { file, canvas, close } = renderer('image/png', [9 * 1024 * 1024, 1024]);
  const result = await prepareStudioImageUpload(file);
  expect(result.type).toBe('image/png');
  expect(canvas.toBlob).toHaveBeenCalledTimes(2);
  expect(canvas.toBlob.mock.calls.every(c => c[1] === 'image/png')).toBe(true);
  expect(close).toHaveBeenCalledOnce();
});
test('original size and camera filename no longer reject before processing', async () => {
  expect(() => validateStudioImageUpload({ name:'camera.heic', size:100 * 1024 * 1024 } as File)).not.toThrow();
  expect(() => validateStudioImageUpload({ name:'camera.webp', size:200 } as File)).not.toThrow();
  const { file } = renderer('image/jpeg', [1024], 10000, 8000, 51 * 1024 * 1024);
  expect((await prepareStudioImageUpload(file)).size).toBe(1024);
});
test('HEIF sniffing uses compatible brands and does not confuse AVIF with HEIC', () => {
  const ftyp = (...brands: string[]) => {
    const bytes = new Uint8Array(16 + (brands.length - 1) * 4), view = new DataView(bytes.buffer);
    view.setUint32(0, bytes.length); bytes.set(new TextEncoder().encode('ftyp'+brands[0]),4);
    brands.slice(1).forEach((brand,i)=>bytes.set(new TextEncoder().encode(brand),16+i*4)); return bytes;
  };
  expect(imageKind(ftyp('mif1','heix'))).toBe('heif');
  expect(imageKind(ftyp('avif','mif1'))).toBe('other');
  expect(imageKind(ftyp('mp42','isom'))).toBe('other');
});
test('a source selected by two entries is decoded once, and its processed result is idempotent', async () => {
  const {file,close} = renderer('image/jpeg',[1024]);
  const [first,second]=await Promise.all([prepareStudioImageUpload(file),prepareStudioImageUpload(file)]);
  expect(second).toBe(first); expect(await prepareStudioImageUpload(first)).toBe(first); expect(close).toHaveBeenCalledOnce();
});
test('multi-photo forms preserve repeated fields, text and non-image media', async () => {
  const first=new File([jpeg()],'one.jpg',{type:'image/jpeg'}), second=new File([jpeg()],'two.jpg',{type:'image/jpeg'});
  const form=new FormData();form.append('files',first);form.append('files',second);form.append('mode','upload');
  const audio=new File(['audio'],'voice.mp3',{type:'audio/mpeg'});form.append('audio',audio);
  const ready=await prepareImageFormData(form);
  expect(ready.getAll('files')).toEqual([first,second]);expect(ready.get('mode')).toBe('upload');expect(ready.get('audio')).toBe(audio);
});
test('a long screenshot stays within the output canvas budget without changing its aspect ratio', () => {
  expect(fitUploadImage(2000,30000)).toEqual({width:533,height:8000});
});
test('wrong extension and empty MIME are corrected from the file bytes without recompression', async () => {
  const original = new File([jpeg()], 'photo.heic', { type: '' });
  const decode = vi.fn(); vi.stubGlobal('createImageBitmap',decode);
  const ready = await prepareStudioImageUpload(original);
  expect(ready.name).toBe('photo.jpg'); expect(ready.type).toBe('image/jpeg');
  expect(new Uint8Array(await ready.arrayBuffer())).toEqual(jpeg()); expect(decode).not.toHaveBeenCalled();
});


test('an opaque large PNG becomes JPEG without shrinking another step to satisfy the PNG byte size', async () => {
  const {file,canvas,drawImage}=renderer('image/png',[1024],4032,3024,12*1024*1024,false);
  const result=await prepareStudioImageUpload(file);
  expect(result.type).toBe('image/jpeg');expect(result.name).toBe('透明原图.jpg');
  expect(canvas.toBlob).toHaveBeenCalledTimes(1);expect(drawImage).toHaveBeenCalledWith(expect.anything(),0,0,4032,3024);
});
test('the former 4MB/4096 boundary no longer re-encodes ordinary high-resolution photos', async () => {
  const file=new File([jpeg(7*1024*1024,6000,4000)],'phone.jpg',{type:'image/jpeg'});
  const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);
  expect(await prepareStudioImageUpload(file)).toBe(file);expect(decode).not.toHaveBeenCalled();
});
test('a twelve-MB camera original is preserved for canvas and compressed only for the 8MB media API', async () => {
  const {file,canvas}=renderer('image/jpeg',[1024],4032,3024,12*1024*1024);
  expect(await prepareImageForUpload(file)).toBe(file);
  expect((await prepareStudioImageUpload(file)).size).toBe(1024);expect(canvas.toBlob).toHaveBeenCalledOnce();
});
test('callers can raise their byte and dimension policy instead of being clamped to global defaults',async()=>{
  const file=new File([jpeg(17*1024*1024,9000,2000)],'wide.jpg',{type:'image/jpeg'});
  expect(await prepareImageForUpload(file,{maxBytes:20*1024*1024,maxEdge:10000,maxPixels:24_000_000})).toBe(file);
});
test('unreadable content and out-of-memory failures give different actionable errors',async()=>{
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('unsupported')));
  await expect(prepareImageForUpload(new File(['not an image'],'data.bin'))).rejects.toMatchObject({code:'IMAGE_NOT_RECOGNIZED',message:'这个文件不是能识别的图片'});
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new RangeError('Array buffer allocation failed')));
  await expect(prepareImageForUpload(new File(['large'],'photo.jpg'))).rejects.toMatchObject({code:'IMAGE_MEMORY_LIMIT'});
});

test('a compliant original does not wait behind another entry’s pending HEIC decode',async()=>{
  let worker:{onmessage?:(event:unknown)=>void;terminate:ReturnType<typeof vi.fn>}|undefined;
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('HEIC unsupported natively')));
  vi.stubGlobal('Worker',class {
    onmessage?:(event:unknown)=>void;onerror?:()=>void;terminate=vi.fn();
    constructor(){worker=this;}postMessage(){}
  });
  const heic=new File(['HEIF'],'queued.heic',{type:'image/heic'});
  const pending=prepareImageForUpload(heic);
  let first:File|undefined;
  try{
    await vi.waitFor(()=>expect(worker).toBeDefined());
    const original=new File([jpeg()],'small.jpg',{type:'image/jpeg'});
    const result=await Promise.race([prepareImageForUpload(original),new Promise<null>(resolve=>setTimeout(()=>resolve(null),100))]);
    expect(result).toBe(original);
  }finally{
    worker?.onmessage?.({data:{blob:new Blob([jpeg()],{type:'image/jpeg'})}});
    first=await pending;
  }
  expect(first?.type).toBe('image/jpeg');expect(worker?.terminate).toHaveBeenCalledOnce();
});
test('HEIC conversion failure gives a conversion alternative rather than asking for the same retry',async()=>{
  vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('unsupported')));
  vi.stubGlobal('Worker',class {
    onmessage?:(event:unknown)=>void;onerror?:()=>void;terminate=vi.fn();
    postMessage(){queueMicrotask(()=>this.onmessage?.({data:{code:'IMAGE_HEIC_CONVERSION_FAILED'}}));}
  });
  await expect(prepareImageForUpload(new File(['HEIF'],'bad.heic',{type:'image/heic'})))
    .rejects.toMatchObject({code:'IMAGE_HEIC_CONVERSION_FAILED',message:'这张 HEIC 没能在浏览器里转换，可以先转成 JPG 再上传'});
});
