import { Activity } from './wardrobe';

export interface SavedOutfit {
  name: string;
  activity: Activity;
  items: string[];
}
export function outfitSignature(outfit: SavedOutfit) {
  return JSON.stringify([outfit.name.trim(), outfit.activity, [...new Set(outfit.items)].sort()]);
}
export function saveOutfit(previous: SavedOutfit[], draft: SavedOutfit): SavedOutfit[] {
  const name = draft.name.trim();
  if (!name) throw new Error('An outfit needs a name.');
  return [
    ...previous.filter((o) => o.name.trim() !== name),
    { name, activity: draft.activity, items: [...new Set(draft.items)] },
  ].slice(-5);
}
