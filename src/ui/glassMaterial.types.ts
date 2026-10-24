import { C } from './theme';
export type GlassMaterialProps = { radius: number; tint: string; reduced: boolean };
export function glassTint(color: string, alpha: number) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : C.paper;
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
