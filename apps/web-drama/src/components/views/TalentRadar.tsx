"use client";

// 演员才艺六维雷达图：唱、演、舞、主持、喜剧、综艺。
// 使用 recharts 的 RadarChart；颜色绑定主题 token（金色 + 暖象牙）。

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import type { TalentProfile } from "@ai-star-eco/types/artist";

interface Props {
  talents: TalentProfile;
  size?: number;
}

const AXES: { key: keyof TalentProfile; label: string }[] = [
  { key: "singing", label: "声乐" },
  { key: "acting", label: "演技" },
  { key: "dancing", label: "舞蹈" },
  { key: "hosting", label: "主持" },
  { key: "comedy", label: "喜剧" },
  { key: "variety", label: "综艺" },
];

export function TalentRadar({ talents, size = 260 }: Props) {
  const data = AXES.map((a) => ({ axis: a.label, value: talents[a.key] }));
  return (
    <div style={{ width: "100%", height: size }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="76%">
          <PolarGrid stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{
              fill: "rgba(200,192,176,0.85)",
              fontSize: 11,
              fontFamily: "var(--font-sans)",
              letterSpacing: 0.4,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            stroke="rgba(255,255,255,0.10)"
          />
          <Radar
            dataKey="value"
            stroke="#d4af6a"
            fill="#d4af6a"
            fillOpacity={0.32}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
