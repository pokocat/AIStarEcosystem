import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const path=(value:string)=>fileURLToPath(new URL(value,import.meta.url));
export default defineConfig({
 resolve:{alias:{'@':path('./src')}},esbuild:{jsx:'automatic'},
 test:{include:['src/**/*.test.tsx'],environment:'jsdom',setupFiles:[path('../../scripts/vitest/setup-storage.ts')]},
});
