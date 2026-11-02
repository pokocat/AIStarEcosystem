import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const mocks=vi.hoisted(()=>({factory:vi.fn(),image:{get_width:vi.fn(),get_height:vi.fn(),is_primary:()=>true,has_alpha_channel:()=>false,display:vi.fn(),free:vi.fn()}}));
vi.mock('libheif-js/libheif-wasm/libheif-bundle.mjs',()=>({default:mocks.factory}));
const scope:{onmessage?:(event:unknown)=>Promise<void>;postMessage:ReturnType<typeof vi.fn>}={postMessage:vi.fn()};
beforeEach(async()=>{
  vi.resetModules();vi.clearAllMocks();
  vi.stubGlobal('self',scope);vi.stubGlobal('navigator',{deviceMemory:4});
  vi.stubGlobal('ImageData',vi.fn(function(){}));
  mocks.factory.mockResolvedValue({HeifDecoder:class{decode(){return[mocks.image];}}});
  mocks.image.get_width.mockReturnValue(1280);mocks.image.get_height.mockReturnValue(854);
  mocks.image.display.mockImplementation((data,callback)=>callback(data));
  await import('./image-upload.worker');
});
afterEach(()=>vi.unstubAllGlobals());
const request=()=>scope.onmessage!({data:{file:new File(['heif'],'photo.heic'),maxBytes:8*1024*1024,maxEdge:8000,maxPixels:24_000_000}});
test('an excessive HEIC is stopped before allocating ImageData or decoding pixels',async()=>{
  mocks.image.get_width.mockReturnValue(20000);mocks.image.get_height.mockReturnValue(10000);
  await request();expect(ImageData).not.toHaveBeenCalled();expect(mocks.image.display).not.toHaveBeenCalled();
  expect(scope.postMessage).toHaveBeenCalledWith({code:'IMAGE_MEMORY_LIMIT'});expect(mocks.image.free).toHaveBeenCalledOnce();
});
test('48MP remains eligible at the normal budget; an actual allocation failure is identified as memory exhaustion',async()=>{
  mocks.image.get_width.mockReturnValue(8064);mocks.image.get_height.mockReturnValue(6048);
  vi.stubGlobal('ImageData',vi.fn(function(){throw new RangeError('Array buffer allocation failed');}));
  await request();expect(ImageData).toHaveBeenCalledOnce();expect(scope.postMessage).toHaveBeenCalledWith({code:'IMAGE_MEMORY_LIMIT'});
});
test('low-memory devices check a smaller pixel budget before allocating the source buffer',async()=>{
  vi.stubGlobal('navigator',{deviceMemory:2});mocks.image.get_width.mockReturnValue(8064);mocks.image.get_height.mockReturnValue(6048);
  await request();expect(ImageData).not.toHaveBeenCalled();expect(scope.postMessage).toHaveBeenCalledWith({code:'IMAGE_MEMORY_LIMIT'});
});
test('codec failures do not produce a retry instruction or a pretend success',async()=>{
  mocks.factory.mockRejectedValue(new Error('invalid HEVC bitstream'));
  await request();expect(scope.postMessage).toHaveBeenCalledWith({code:'IMAGE_HEIC_CONVERSION_FAILED'});
});
