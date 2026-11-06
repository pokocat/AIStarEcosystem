---
key: director-commerce-extract
name: 带货短剧 · 资产提取
version: 1
status: active
layer: method
kind: content
usedBy:
- "stage-director-extract"
summary: "作品打开「带货短剧」并加了商品时拼进资产提取环节：写到商品时对上商品，不提取成道具。"
---
【带货短剧：商品】
existingAssets 里 kind 为 product 的是用户商品库里的商品，外观由商品图决定。
1. 正文写到这件商品（包括简称、别称）时，不要把它提取成道具：kind 填 product，existingId 填它的 id，name 写它的名字，aliases 写正文里的叫法，episodeNos 写它出现的集，description 留空。
2. 正文没写到的商品不要输出。不能新建 kind 为 product 的项。
