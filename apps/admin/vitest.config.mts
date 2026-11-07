import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const path=(value:string)=>fileURLToPath(new URL(value,import.meta.url));
export default defineConfig({
 resolve:{alias:{'@':path('./src')}},esbuild:{jsx:'automatic'},
 // 默认 5 秒、不限进程数时，pnpm test:all 同时跑全部项目，CI 和高负载的本机上会出现超时假失败。和 web-aiavatar 同一套设置，见它的 vitest.config.ts。
 test:{include:['src/**/*.test.tsx'],environment:'jsdom',maxWorkers:'50%',minWorkers:1,testTimeout:15_000,setupFiles:[path('../../scripts/vitest/setup-storage.ts')]},
});
