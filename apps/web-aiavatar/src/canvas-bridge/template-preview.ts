import type { IpProjectDoc, StudioTemplateVersion } from '@ai-star-eco/types';

/** A local view of the published recipe. Opening it never creates or saves a project. */
export function templatePreviewDocument(version: StudioTemplateVersion): IpProjectDoc {
  const doc = structuredClone(version.doc);
  const inputs = new Map(version.recipe.inputs.map(input => [input.id, input]));
  for (const input of inputs.values()) {
    const node = doc.nodes.find(n => n.id === input.nodeId);
    if (!node) continue;
    node.metadata ??= {};
    if (input.type === 'text' || input.type === 'option') node.metadata.content = input.defaultValue || '';
  }
  for (const step of version.recipe.steps) {
    const node = doc.nodes.find(n => n.id === step.nodeId);
    if (!node) continue;
    node.metadata ??= {};
    node.metadata.prompt = step.prompt.replace(/\{\{([a-zA-Z0-9_-]+)}}/g, (_, id: string) => {
      const input = inputs.get(id);
      if (input && (input.type === 'text' || input.type === 'option') && !doc.connections.some(e => e.fromNodeId === input.nodeId && e.toNodeId === node.id))
        doc.connections.push({ id: `preview-${input.nodeId}-${node.id}`, fromNodeId: input.nodeId, toNodeId: node.id });
      return '';
    });
    node.metadata.size = step.aspectRatio || step.size;
    if (step.durationSec) node.metadata.seconds = step.durationSec;
  }
  return doc;
}
