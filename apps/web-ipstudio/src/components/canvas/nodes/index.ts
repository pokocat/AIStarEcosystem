import type { NodeTypes } from "@xyflow/react";
import { GenerateNode } from "./generate-node";
import { IdentityNode } from "./identity-node";
import { LookNode } from "./look-node";
import { PublishNode } from "./publish-node";
import { ReferenceNode } from "./reference-node";
import { SourceNode } from "./source-node";
import { StyleNode } from "./style-node";

/** React Flow 的 nodeTypes 映射（key 必须等于 IpNodeType）。模块级常量，避免每次渲染重建。 */
export const IP_NODE_TYPES: NodeTypes = {
  source: SourceNode,
  identity: IdentityNode,
  style: StyleNode,
  look: LookNode,
  generate: GenerateNode,
  reference: ReferenceNode,
  publish: PublishNode,
};
