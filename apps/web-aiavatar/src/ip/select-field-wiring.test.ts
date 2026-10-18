// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import { expect,test } from 'vitest';

// Prevent new raw select menus bypassing the shared interaction after this audit.
test('runtime web fields do not reintroduce OS select popups',()=>{
 const root=resolve(process.cwd(),'../..'),found:string[]=[];
 const scan=(dir:string)=>{for(const file of readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.next','dist'].includes(file.name))continue;
  const path=resolve(dir,file.name);
  if(file.isDirectory()){scan(path);continue;}
  if(!path.endsWith('.tsx')||path.includes('.test.'))continue;
  const source=readFileSync(path,'utf8');if(!source.includes('<select'))continue;
  const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=(node:ts.Node)=>{if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(tree)==='select')found.push(relative(root,path));ts.forEachChild(node,visit);};visit(tree);
 }};
 for(const app of ['web-aiavatar','web-drama','web-music','web-celebrity','web-star','admin'])scan(resolve(root,'apps',app,'src'));
 scan(resolve(root,'packages/ui/src'));
 expect(found).toEqual(['packages/ui/src/ui/select-field.tsx']);
});
