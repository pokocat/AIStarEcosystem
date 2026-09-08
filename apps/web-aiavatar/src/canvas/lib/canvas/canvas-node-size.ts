export function fitNodeSize(width: number, height: number, maxWidth = 640, maxHeight = 640) {
    // 尺寸未知（服务端候选图只回 {key,url}，没有宽高）时按上限铺满。
    // 此前 Math.max(1, 0) = 1，scale 算成 1，节点直接变成 1×1 像素 —— 图在那儿，但看不见。
    if (!(width > 0) || !(height > 0)) return { width: maxWidth, height: maxHeight };
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    return { width: w * scale, height: h * scale };
}

export function nodeSizeFromRatio(size: string, baseWidth: number, baseHeight: number) {
    const match = size?.match(/^(\d+)(?:x|:)(\d+)/);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    const ratio = width / Math.max(1, height);
    if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight };
    return ratio >= baseWidth / baseHeight ? { width: baseWidth, height: baseWidth / ratio } : { width: baseHeight * ratio, height: baseHeight };
}
