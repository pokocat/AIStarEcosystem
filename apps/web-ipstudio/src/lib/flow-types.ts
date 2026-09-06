import type { Node } from "@xyflow/react";
import type { IpNode, IpNodeType, IpRun } from "@ai-star-eco/types";

/** React Flow 节点 data：画布节点本体 + 该节点最近一次运行 + 是否正在运行。 */
export type IpFlowNodeData = {
  node: IpNode;
  run?: IpRun;
  running?: boolean;
};

export type IpFlowNode = Node<IpFlowNodeData, IpNodeType>;
