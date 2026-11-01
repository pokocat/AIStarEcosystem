---
key: stage-image
name: 画布出图包装
version: 1
status: active
layer: stage
target: image-model
callPoints:
- "画布出图 / 导演台出图（IpRunService）"
importFrom: dap.ip_canvas_image
summary: "画布出图时交给画图模型的英文包装（§8 #15）。参考图说明（保持同一个人、参考图编号、各自是什么）也在这里，加不加由代码按参考图数量判断。"
---
{{#identity}}Use the provided reference image as the identity source. Keep the same person: same face, same facial proportions, same hairstyle and hair color, same skin tone, same signature features (marks, freckles, glasses, accessories). Change only what the following instruction asks for. {{/identity}}{{#ordered}}The reference images are given in order: {{#refs}}{{^-first}}, {{/-first}}image {{n}} = 图{{n}}{{/refs}}. {{/ordered}}{{#refs}}{{#note}}Reference image {{n}}: {{note}}. {{/note}}{{/refs}}Follow the final instruction for subject count, camera angle, crop, layout, and text. When a character sheet, multi-view grid, expression sheet, or detail board is requested, repeat the SAME character with consistent identity, visual style, outfit, and proportions in the requested panels. Otherwise produce one single scene; use a full-body view only when no framing is specified. Preserve the visual style of the reference in every panel and close-up. Do not invent outfits, accessories, identity facts, or props absent from the reference or instruction. Clean composition, consistent lighting, high quality, sharp details. Unless explicitly requested, avoid collages, duplicated subjects, extra people, text, captions, logos, and signatures. No watermarks, deformed hands, or extra limbs. The final instruction below determines the requested image:
{{prompt}}
