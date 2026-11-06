import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { Lang } from '../translations';
import { CENTER_ARTIST, type EcosystemLayer } from '../data/entertainmentLayers';

// SVG coordinate system: a 600×600 square with the AI artist at the centre.
const SIZE = 600;
const C = SIZE / 2;
const LABEL_R = 132;
const NODE_R = 240;
const AVATAR_R = 70;
const NODE_SPREAD = 20; // degrees between role nodes within one layer

const polar = (angle: number, r: number) => {
  const a = (angle * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const pct = (value: number) => `${(value / SIZE) * 100}%`;
const roleAngle = (layer: EcosystemLayer, index: number) =>
  layer.angle + (index - (layer.roles.length - 1) / 2) * NODE_SPREAD;

interface Props {
  lang: Lang;
  layers: EcosystemLayer[];
  active: number;
  onActiveChange: (index: number) => void;
}

/**
 * Entertainment IP galaxy: the AI artist sits at the centre and four collaboration layers
 * orbit around it. Light particles show how value flows between each role and the artist.
 */
export const EntertainmentGalaxy = ({ lang, layers, active, onActiveChange }: Props) => {
  const zh = lang === 'zh';
  const reduceMotion = useReducedMotion();
  const [roleIndex, setRoleIndex] = useState(0);
  // Role requested together with a layer change (e.g. clicking a node in another layer).
  const pendingRole = useRef<number | null>(null);

  // Changing layer resets the highlighted role, unless a specific role was requested.
  useEffect(() => {
    setRoleIndex(pendingRole.current ?? 0);
    pendingRole.current = null;
  }, [active]);

  const layer = layers[active];
  const currentRole = layer.roles[Math.min(roleIndex, layer.roles.length - 1)];
  const LayerIcon = layer.icon;

  const selectRole = (layerIndex: number, index: number) => {
    if (layerIndex !== active) {
      pendingRole.current = index;
      onActiveChange(layerIndex);
    } else {
      setRoleIndex(index);
    }
  };

  const flowText = (item: EcosystemLayer, roleName: string) => {
    const artist = zh ? 'AI 艺人' : 'AI artist';
    return item.direction === 'in' ? `${roleName} → ${artist}` : `${artist} → ${roleName}`;
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-10 items-center max-w-6xl mx-auto">
      {/* ── Left: role detail + layer list (also the mobile experience) ── */}
      <div className="space-y-4 order-2 lg:order-1">
        {/* Phones: the diagram is hidden, so anchor the list on the AI artist instead. */}
        <div className="md:hidden flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden" style={{ background: `conic-gradient(${layers.map(l => l.color).join(', ')}, ${layers[0].color})` }}>
            <div className="absolute inset-[2px] rounded-full overflow-hidden bg-black">
              <img src={CENTER_ARTIST.image} alt={CENTER_ARTIST.name} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-400">{zh ? '生态中心 · AI 艺人' : 'At the centre · AI Artist'}</div>
            <div className="text-lg text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{CENTER_ARTIST.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{zh ? '四层角色围绕同一个 IP 协作' : 'Four layers collaborate around one IP'}</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${active}-${currentRole.en}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: .25 }}
            className="rounded-2xl p-5 border"
            style={{ borderColor: `${layer.color}45`, background: `linear-gradient(145deg, ${layer.color}16, rgba(6,10,18,.92) 65%)` }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: layer.color }}>
              <LayerIcon className="w-3.5 h-3.5" /> {zh ? layer.zh : layer.en}
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <h3 className="text-2xl text-white font-black" style={{ fontFamily: 'var(--font-display)' }}>{zh ? currentRole.zh : currentRole.en}</h3>
              <div className="text-right shrink-0">
                <div className="text-lg font-black" style={{ color: layer.color, fontFamily: 'var(--font-display)' }}>{(zh ? currentRole.statZh : currentRole.statEn).split(' ')[0]}</div>
                <div className="text-xs text-gray-500">{(zh ? currentRole.statZh : currentRole.statEn).split(' ').slice(1).join(' ')}</div>
              </div>
            </div>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">{zh ? currentRole.descZh : currentRole.descEn}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white/80 bg-black/40 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: layer.color, boxShadow: `0 0 8px ${layer.color}` }} />
              {flowText(layer, zh ? currentRole.zh : currentRole.en)} · {zh ? layer.flowZh : layer.flowEn}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="relative space-y-2">
          {layers.map((item, li) => {
            const Icon = item.icon;
            const isActive = li === active;
            return (
              <div key={item.en} className="rounded-2xl border transition-colors"
                style={{ borderColor: isActive ? `${item.color}55` : 'rgba(255,255,255,.08)', background: isActive ? `${item.color}0f` : 'rgba(255,255,255,.02)' }}>
                <button type="button" onClick={() => onActiveChange(li)} aria-expanded={isActive}
                  className="w-full flex items-center gap-3 p-3.5 text-left">
                  <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color2})`, boxShadow: isActive ? `0 8px 22px ${item.color}35` : undefined }}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white font-semibold">{zh ? item.zh : item.en}</span>
                    <span className="block text-xs text-gray-500 truncate">{zh ? item.flowZh : item.flowEn} · {zh ? item.count : item.countEn}</span>
                  </span>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'rotate-90' : ''}`} style={{ color: isActive ? item.color : '#4b5563' }} />
                </button>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3.5 pb-3.5 flex flex-wrap gap-1.5">
                        {item.roles.map((r, ri) => {
                          const selected = ri === roleIndex;
                          return (
                            <button key={r.en} type="button" onClick={() => selectRole(li, ri)}
                              className="rounded-full px-3 py-1.5 text-xs border transition"
                              style={selected
                                ? { color: '#fff', borderColor: item.color, background: `${item.color}30` }
                                : { color: '#9ca3af', borderColor: 'rgba(255,255,255,.1)' }}>
                              {zh ? r.zh : r.en}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: the galaxy diagram (desktop / tablet) ── */}
      <div className="order-1 lg:order-2 hidden md:block">
        <div className="relative aspect-square w-full max-w-[600px] mx-auto select-none">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full" aria-hidden>
            <defs>
              <radialGradient id="galaxy-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={layer.color} stopOpacity=".22" />
                <stop offset="45%" stopColor="#7c3aed" stopOpacity=".06" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={C - 4} fill="url(#galaxy-glow)" />

            {/* Orbit rings — dashes drift slowly to suggest rotation */}
            {[LABEL_R, NODE_R].map((r, i) => (
              <motion.circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" strokeDasharray={i ? '2 10' : '4 8'}
                animate={reduceMotion ? undefined : { rotate: i ? -360 : 360 }}
                transition={{ duration: i ? 140 : 90, repeat: Infinity, ease: 'linear' }} />
            ))}

            {/* Connections + flowing particles */}
            {layers.map((item, li) => item.roles.map((r, ri) => {
              const angle = roleAngle(item, ri);
              const from = polar(angle, AVATAR_R + 4);
              const to = polar(angle, NODE_R - 26);
              const path = item.direction === 'in'
                ? `M ${to.x} ${to.y} L ${from.x} ${from.y}`
                : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
              const isActive = li === active;
              const isRole = isActive && ri === roleIndex;
              return (
                <g key={`${item.en}-${r.en}`} opacity={isActive ? 1 : .28} style={{ transition: 'opacity .4s' }}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={item.color} strokeOpacity={isRole ? .9 : .4} strokeWidth={isRole ? 2 : 1} />
                  {!reduceMotion && (
                    <circle r={isRole ? 3.5 : 2.5} fill={item.color}>
                      <animateMotion dur={`${2.4 + ri * .35}s`} begin={`${ri * .4}s`} repeatCount="indefinite" path={path} />
                    </circle>
                  )}
                </g>
              );
            }))}
          </svg>

          {/* Centre: the AI artist */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ width: pct(AVATAR_R * 2) }}>
            {!reduceMotion && (
              <motion.span className="absolute inset-0 aspect-square rounded-full" style={{ border: `1px solid ${layer.color}` }}
                animate={{ scale: [1, 1.35], opacity: [.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }} />
            )}
            <div className="relative w-full aspect-square rounded-full overflow-hidden" style={{ background: `conic-gradient(from 0deg, ${layers.map(l => l.color).join(', ')}, ${layers[0].color})` }}>
              <div className="absolute inset-[3px] rounded-full overflow-hidden bg-black">
                <img src={CENTER_ARTIST.image} alt={CENTER_ARTIST.name} className="absolute inset-0 w-full h-full object-cover" />
              </div>
            </div>
            <div className="absolute -bottom-3 whitespace-nowrap rounded-full border border-white/20 bg-black/80 backdrop-blur px-3 py-1 text-xs text-white">
              <span className="font-black tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{CENTER_ARTIST.name}</span>
              <span className="text-gray-400"> · {zh ? 'AI 艺人' : 'AI Artist'}</span>
            </div>
          </div>

          {/* Layer labels on the inner orbit */}
          {layers.map((item, li) => {
            const p = polar(item.angle, LABEL_R);
            const isActive = li === active;
            return (
              <button key={item.en} type="button" onClick={() => onActiveChange(li)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap backdrop-blur transition"
                style={{ left: pct(p.x), top: pct(p.y), color: isActive ? '#fff' : item.color, background: isActive ? `${item.color}cc` : 'rgba(0,0,0,.6)', border: `1px solid ${item.color}70`, boxShadow: isActive ? `0 0 24px ${item.color}60` : undefined }}>
                {zh ? item.zh : item.en}
              </button>
            );
          })}

          {/* Role nodes on the outer orbit — fly out from the centre on first view */}
          {layers.map((item, li) => item.roles.map((r, ri) => {
            const p = polar(roleAngle(item, ri), NODE_R);
            const Icon = item.icon;
            const isActive = li === active;
            const isRole = isActive && ri === roleIndex;
            return (
              <motion.button
                key={`${item.en}-${r.en}`}
                type="button"
                onMouseEnter={() => selectRole(li, ri)}
                onFocus={() => selectRole(li, ri)}
                onClick={() => selectRole(li, ri)}
                aria-label={`${zh ? item.zh : item.en} · ${zh ? r.zh : r.en}`}
                className="absolute flex flex-col items-center gap-1.5 w-24"
                style={{ x: '-50%', y: '-22px' }}
                initial={reduceMotion ? false : { left: '50%', top: '50%', opacity: 0, scale: .4 }}
                whileInView={{ left: pct(p.x), top: pct(p.y), opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: .3 }}
                transition={{ type: 'spring', stiffness: 120, damping: 16, delay: reduceMotion ? 0 : .15 + li * .12 + ri * .05 }}
                whileHover={{ scale: 1.08 }}
              >
                <span className="flex flex-col items-center gap-1.5 transition-opacity duration-300" style={{ opacity: isActive ? 1 : .5 }}>
                <motion.span
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 3 + ri * .4, repeat: Infinity, ease: 'easeInOut', delay: ri * .3 }}
                  style={{
                    background: isRole ? `linear-gradient(135deg, ${item.color}, ${item.color2})` : 'rgba(8,12,22,.92)',
                    border: `1px solid ${item.color}${isRole ? '' : '80'}`,
                    boxShadow: isRole ? `0 0 0 5px ${item.color}25, 0 0 28px ${item.color}80` : `0 0 14px ${item.color}25`,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: isRole ? '#fff' : item.color }} />
                </motion.span>
                <span className="text-xs leading-tight text-center" style={{ color: isRole ? '#fff' : '#cbd5e1', fontWeight: isRole ? 700 : 500 }}>
                  {zh ? r.zh : r.en}
                </span>
                </span>
              </motion.button>
            );
          }))}
        </div>
      </div>
    </div>
  );
};

export default EntertainmentGalaxy;
