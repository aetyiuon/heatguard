import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { SKY_HORIZON, SKY_LAYERS, SkyScene, SkyStops } from '../domain/sky';

// Decorative and behind every surface: hidden from assistive technology, never intercepts
// touches or map gestures. Each moving layer is drawn once and shifted with one looping
// transform, so per-frame work stays flat as particles grow. Colors and peak opacities come
// from SKY_LAYERS, whose contrast against theme text is covered by tests/sky.test.ts.
const nativeDriver = Platform.OS !== 'web';
const fill = StyleSheet.absoluteFill;
const L = SKY_LAYERS;
const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (v) => alive && setReduced(v),
      () => {},
    );
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** 0→1 repeating (linear) or 0→1→0 (wave); parked at 0 when motion is off. */
function useLoop(duration: number, run: boolean, wave = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (!run) return;
    const timing = (toValue: number, ms: number) =>
      Animated.timing(value, {
        toValue,
        duration: ms,
        easing: wave ? Easing.inOut(Easing.sin) : Easing.linear,
        useNativeDriver: nativeDriver,
      });
    const loop = Animated.loop(
      wave
        ? Animated.sequence([timing(1, duration / 2), timing(0, duration / 2)])
        : timing(1, duration),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, run, wave, value]);
  return value;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SkyGradient({ colors }: { colors: SkyStops }) {
  const key = colors.join();
  const shown = useRef(colors);
  const [layers, setLayers] = useState({ from: colors, to: colors });
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (shown.current.join() === key) return;
    setLayers({ from: shown.current, to: colors });
    shown.current = colors;
  }, [key]);
  // Reset before paint so the incoming colors never flash at full strength.
  useLayoutEffect(() => {
    fade.setValue(0);
    const a = Animated.timing(fade, {
      toValue: 1,
      duration: 1400,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: nativeDriver,
    });
    a.start();
    return () => a.stop();
  }, [layers, fade]);
  return (
    <>
      <LinearGradient colors={layers.from} locations={[0, 0.55, 1]} style={fill} />
      <Animated.View style={[fill, { opacity: fade }]}>
        <LinearGradient colors={layers.to} locations={[0, 0.55, 1]} style={fill} />
      </Animated.View>
    </>
  );
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 900,
      useNativeDriver: nativeDriver,
    }).start();
  }, [opacity]);
  return <Animated.View style={[fill, { opacity }]}>{children}</Animated.View>;
}

function HorizonGlow({
  width,
  height,
  glow,
}: {
  width: number;
  height: number;
  glow: NonNullable<SkyScene['glow']>;
}) {
  return (
    <Svg width={width} height={height} style={fill}>
      <Defs>
        <RadialGradient
          id="hgHorizonGlow"
          cx={glow.x * width}
          cy={SKY_HORIZON * height}
          r={Math.max(width, height) * 0.62}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={glow.color} stopOpacity={glow.strength} />
          <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#hgHorizonGlow)" />
    </Svg>
  );
}

function Stars({
  width,
  height,
  amount,
  run,
}: {
  width: number;
  height: number;
  amount: number;
  run: boolean;
}) {
  const stars = useMemo(() => {
    const rnd = seeded(7);
    const n = Math.round(Math.min(120, (width * height) / 8000));
    return Array.from({ length: n }, () => ({
      x: rnd() * width,
      y: rnd() * height * 0.75,
      r: 0.5 + rnd() * 1.1,
      group: rnd() < 0.5 ? 0 : 1,
    }));
  }, [width, height]);
  const twinkle = useLoop(5200, run, true);
  const opacities = [
    twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.3] }),
    twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }),
  ];
  return (
    <View style={[fill, { opacity: amount }]}>
      {opacities.map((opacity, group) => (
        <Animated.View key={group} style={[fill, { opacity }]}>
          <Svg width={width} height={height}>
            {stars
              .filter((s) => s.group === group)
              .map((s, i) => (
                <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={L.particle} />
              ))}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
/** The HeatGuard sun mark, enlarged: an amber ring and rays over a faint glow. */
function Sun({
  x,
  y,
  size,
  heat,
  run,
}: {
  x: number;
  y: number;
  size: number;
  heat: 0 | 1 | 2;
  run: boolean;
}) {
  const spin = useLoop(160_000, run);
  const pulse = useLoop(heat ? 4200 : 7000, run, true);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, heat ? 1.1 : 1.04] });
  const glow = size * (heat === 2 ? 3.6 : heat ? 3.2 : 2.8);
  return (
    <View
      style={{
        position: 'absolute',
        left: x - glow / 2,
        top: y - glow / 2,
        width: glow,
        height: glow,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[fill, { transform: [{ scale }] }]}>
        <Svg width={glow} height={glow}>
          <Defs>
            <RadialGradient id="hgSunGlow" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0"
                stopColor={L.sun}
                stopOpacity={heat ? L.sunGlow.heat : L.sunGlow.day}
              />
              <Stop offset="1" stopColor={L.sun} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill="url(#hgSunGlow)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Circle cx="24" cy="24" r="8" fill={L.sun} fillOpacity={L.sunCore} />
          <Circle cx="24" cy="24" r="8" fill="none" stroke={L.sun} strokeWidth="1.6" />
          <G stroke={L.sun} strokeWidth="1.6" strokeLinecap="round">
            {RAYS.map((a) => (
              <Line
                key={a}
                x1={24 + 13 * Math.cos(a)}
                y1={24 + 13 * Math.sin(a)}
                x2={24 + 18 * Math.cos(a)}
                y2={24 + 18 * Math.sin(a)}
              />
            ))}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Lit portion of a disc of radius r for phase p (0 new, 0.5 full), lit side right when waxing. */
function moonPath(r: number, p: number) {
  const waxing = p < 0.5;
  const c = Math.cos(2 * Math.PI * p);
  const rx = Math.abs(c) * r;
  // A crescent's terminator bulges toward the lit limb; a gibbous one bulges away from it.
  const limb = waxing ? 1 : 0;
  const terminator = waxing === c > 0 ? 0 : 1;
  return `M0 ${-r}A${r} ${r} 0 0 ${limb} 0 ${r}A${rx} ${r} 0 0 ${terminator} 0 ${-r}Z`;
}

/** Line-art moon in its current phase, with the unlit disc faintly outlined. */
function Moon({
  x,
  y,
  size,
  phase,
  south,
}: {
  x: number;
  y: number;
  size: number;
  phase: number;
  south: boolean;
}) {
  const r = size / 2,
    box = size * 2.6,
    c = box / 2;
  const lit = moonPath(r, phase);
  return (
    <Svg width={box} height={box} style={{ position: 'absolute', left: x - c, top: y - c }}>
      <Defs>
        <RadialGradient id="hgMoonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={L.moon} stopOpacity={L.moonGlow} />
          <Stop offset="1" stopColor={L.moon} stopOpacity={0} />
        </RadialGradient>
        <ClipPath id="hgMoonLit">
          <Path d={lit} />
        </ClipPath>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill="url(#hgMoonGlow)" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={L.moon}
        strokeOpacity={0.18}
        strokeWidth={1}
      />
      <G transform={`translate(${c} ${c}) scale(${south ? -1 : 1} 1)`}>
        <Path
          d={lit}
          fill={L.moon}
          fillOpacity={L.moonFill}
          stroke={L.moon}
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Faint craters on the lit side only, so a full moon reads as a moon, not a ring. */}
        <G clipPath="url(#hgMoonLit)" fill="none" stroke={L.moon} strokeOpacity={0.3}>
          <Circle cx={-0.32 * r} cy={-0.22 * r} r={0.2 * r} strokeWidth={1} />
          <Circle cx={0.28 * r} cy={0.18 * r} r={0.14 * r} strokeWidth={1} />
          <Circle cx={-0.06 * r} cy={0.46 * r} r={0.1 * r} strokeWidth={1} />
        </G>
      </G>
    </Svg>
  );
}

function CloudShape({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <G fill={color}>
      <Rect x={x - 64 * s} y={y - 6 * s} width={128 * s} height={34 * s} rx={17 * s} />
      <Circle cx={x - 28 * s} cy={y - 4 * s} r={26 * s} />
      <Circle cx={x + 10 * s} cy={y - 16 * s} r={32 * s} />
      <Circle cx={x + 42 * s} cy={y + 4 * s} r={20 * s} />
    </G>
  );
}

function CloudLayer({
  tile,
  height,
  clouds,
  color,
  opacity,
  duration,
  run,
}: {
  tile: number;
  height: number;
  clouds: { x: number; y: number; s: number }[];
  color: string;
  opacity: number;
  duration: number;
  run: boolean;
}) {
  const drift = useLoop(duration, run);
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -tile] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tile * 2,
        height,
        opacity,
        transform: [{ translateX }],
      }}
    >
      <Svg width={tile * 2} height={height}>
        {[0, tile].map((offset) =>
          clouds.map((c, i) => (
            <CloudShape key={`${offset}-${i}`} x={c.x + offset} y={c.y} s={c.s} color={color} />
          )),
        )}
      </Svg>
    </Animated.View>
  );
}

function Clouds({
  width,
  height,
  amount,
  color,
  run,
}: {
  width: number;
  height: number;
  amount: number;
  color: string;
  run: boolean;
}) {
  // Clouds stay inside one tile so the seam never cuts one in half when the loop restarts.
  const tile = Math.max(width, 640);
  const layers = useMemo(() => {
    const rnd = seeded(11);
    const make = (k: number, top: number, band: number, s0: number, ds: number) =>
      Array.from({ length: Math.max(1, Math.round(amount * (tile / 190) * k)) }, () => {
        const s = s0 + rnd() * ds;
        return {
          s,
          x: 70 * s + rnd() * (tile - 140 * s),
          y: height * (top + rnd() * band),
        };
      });
    return [
      { clouds: make(1, 0.03, 0.3, 0.45, 0.35), opacity: 0.6, duration: 260_000 },
      { clouds: make(0.75, 0.06, 0.42, 0.8, 0.55), opacity: 1, duration: 170_000 },
    ];
  }, [tile, height, amount]);
  return (
    <>
      {layers.map((l, i) => (
        <CloudLayer key={i} tile={tile} height={height} color={color} run={run} {...l} />
      ))}
    </>
  );
}

/** A tile of particles drawn twice and slid down one tile height per loop. */
function Falling({
  width,
  height,
  duration,
  run,
  sway = 0,
  draw,
}: {
  width: number;
  height: number;
  duration: number;
  run: boolean;
  sway?: number;
  draw: (offsetY: number) => React.ReactNode;
}) {
  const fall = useLoop(duration, run);
  const drift = useLoop(5600, run && sway > 0, true);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-sway, sway] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height: height * 2,
        transform: [{ translateY }, { translateX }],
      }}
    >
      <Svg width={width} height={height * 2}>
        {draw(0)}
        {draw(height)}
      </Svg>
    </Animated.View>
  );
}

function Rain({
  width,
  height,
  amount,
  run,
}: {
  width: number;
  height: number;
  amount: number;
  run: boolean;
}) {
  const layers = useMemo(() => {
    const rnd = seeded(23);
    const count = (k: number) => Math.round(Math.min(150, ((width * height) / 5200) * amount * k));
    const drops = (n: number) =>
      Array.from({ length: n }, () => ({ x: rnd() * width, y: rnd() * height }));
    return [
      { drops: drops(count(0.6)), len: 11, stroke: 1.1, opacity: 0.28, duration: 1300 },
      { drops: drops(count(0.45)), len: 18, stroke: 1.6, opacity: 0.45, duration: 820 },
    ];
  }, [width, height, amount]);
  return (
    <>
      {layers.map((l, i) => (
        <Falling
          key={i}
          width={width}
          height={height}
          duration={l.duration}
          run={run}
          draw={(offset) => (
            <G
              key={offset}
              stroke={L.particle}
              strokeOpacity={l.opacity}
              strokeWidth={l.stroke}
              strokeLinecap="round"
            >
              {l.drops.map((d, j) => (
                <Line key={j} x1={d.x} y1={d.y + offset} x2={d.x - 2} y2={d.y + offset + l.len} />
              ))}
            </G>
          )}
        />
      ))}
    </>
  );
}

function Snow({
  width,
  height,
  amount,
  run,
}: {
  width: number;
  height: number;
  amount: number;
  run: boolean;
}) {
  const layers = useMemo(() => {
    const rnd = seeded(31);
    const count = (k: number) => Math.round(Math.min(120, ((width * height) / 4000) * amount * k));
    const flakes = (n: number, r0: number, dr: number) =>
      Array.from({ length: n }, () => ({
        x: rnd() * width,
        y: rnd() * height,
        r: r0 + rnd() * dr,
      }));
    return [
      { flakes: flakes(count(0.6), 1.1, 1.2), opacity: 0.5, duration: 15_000, sway: 10 },
      { flakes: flakes(count(0.45), 1.8, 1.8), opacity: 0.8, duration: 9_500, sway: 18 },
    ];
  }, [width, height, amount]);
  return (
    <>
      {layers.map((l, i) => (
        <Falling
          key={i}
          width={width}
          height={height}
          duration={l.duration}
          sway={l.sway}
          run={run}
          draw={(offset) => (
            <G key={offset} fill={L.particle} fillOpacity={l.opacity}>
              {l.flakes.map((f, j) => (
                <Circle key={j} cx={f.x} cy={f.y + offset} r={f.r} />
              ))}
            </G>
          )}
        />
      ))}
    </>
  );
}

function Lightning() {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Faint, infrequent double flashes, well under three per second.
    const blink = (peak: number) => [
      Animated.timing(flash, { toValue: peak, duration: 70, useNativeDriver: nativeDriver }),
      Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }),
    ];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(5200),
        ...blink(1),
        Animated.delay(140),
        ...blink(0.6),
        Animated.delay(8600),
        ...blink(0.8),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);
  return (
    <Animated.View
      style={[
        fill,
        {
          backgroundColor: L.flash.color,
          opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, L.flash.alpha] }),
        },
      ]}
    />
  );
}

function Fog({ width, height, run }: { width: number; height: number; run: boolean }) {
  const drift = useLoop(26_000, run, true);
  const bands = [
    { y: 0.36, h: 70, dir: 1 },
    { y: 0.55, h: 92, dir: -1 },
    { y: 0.74, h: 84, dir: 1 },
  ];
  return (
    <>
      {bands.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: -width * 0.2,
            top: height * b.y,
            width: width * 1.4,
            height: b.h,
            borderRadius: b.h / 2,
            backgroundColor: L.fog.color,
            opacity: L.fog.alpha,
            transform: [
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30 * b.dir, 30 * b.dir],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  );
}

function Heat({
  width,
  height,
  level,
  run,
}: {
  width: number;
  height: number;
  level: 1 | 2;
  run: boolean;
}) {
  const shimmer = useLoop(level === 2 ? 3200 : 4600, run, true);
  const translateY = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const wave = (y: number, amp: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= width + 40; x += 40)
      d += ` Q${x + 10} ${y - amp} ${x + 20} ${y} T${x + 40} ${y}`;
    return d;
  };
  const haze = L.haze.alpha[level];
  return (
    <>
      <LinearGradient
        colors={[rgba(L.haze.color, 0), rgba(L.haze.color, haze)]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.5 }}
      />
      <Animated.View style={[fill, { opacity, transform: [{ translateY }] }]}>
        <Svg width={width} height={height}>
          <G
            stroke={L.sun}
            strokeOpacity={0.35}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          >
            {[0.72, 0.8, 0.88].map((f, i) => (
              <Path key={i} d={wave(height * f, 4 + i)} />
            ))}
          </G>
        </Svg>
      </Animated.View>
    </>
  );
}

/** Animated sky for the checked place: sun or moon on its arc, then the current weather. */
export const SkyBackdrop = memo(function SkyBackdrop({ scene }: { scene: SkyScene }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const run = !useReducedMotion();
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) =>
      s && Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height },
    );
  };
  const width = size?.width ?? 0,
    height = size?.height ?? 0;
  const body = Math.max(72, Math.min(150, Math.min(width, height) * 0.22));
  return (
    <View
      onLayout={onLayout}
      aria-hidden
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[fill, { pointerEvents: 'none', overflow: 'hidden' }]}
    >
      <SkyGradient colors={scene.colors} />
      {size ? (
        <>
          {scene.glow ? <HorizonGlow width={width} height={height} glow={scene.glow} /> : null}
          {scene.stars > 0.02 ? (
            <Stars width={width} height={height} amount={scene.stars} run={run} />
          ) : null}
          {/* Overcast skies veil the sun and moon but keep them on their arcs. */}
          {scene.moon ? (
            <View style={[fill, { opacity: scene.clouds >= 0.7 ? 0.45 : 1 }]}>
              <Moon
                x={scene.moon.x * width}
                y={scene.moon.y * height}
                size={body * 0.5}
                phase={scene.moon.phase}
                south={scene.moon.south}
              />
            </View>
          ) : null}
          {scene.sun ? (
            <View style={[fill, { opacity: scene.clouds >= 0.7 ? 0.45 : 1 }]}>
              <Sun
                x={scene.sun.x * width}
                y={scene.sun.y * height}
                size={body}
                heat={scene.heat}
                run={run}
              />
            </View>
          ) : null}
          <FadeIn key={scene.condition ?? 'none'}>
            {scene.heat && scene.sun ? (
              <Heat width={width} height={height} level={scene.heat} run={run} />
            ) : null}
            {scene.clouds > 0.02 ? (
              <Clouds
                width={width}
                height={height}
                amount={scene.clouds}
                color={scene.cloud}
                run={run}
              />
            ) : null}
            {scene.fog ? <Fog width={width} height={height} run={run} /> : null}
            {scene.rain ? (
              <Rain width={width} height={height} amount={scene.rain} run={run} />
            ) : null}
            {scene.snow ? (
              <Snow width={width} height={height} amount={scene.snow} run={run} />
            ) : null}
            {scene.lightning && run ? <Lightning /> : null}
          </FadeIn>
        </>
      ) : null}
    </View>
  );
});
