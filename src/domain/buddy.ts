import { Buddy } from './types';

/** Accept common display formatting but require a usable 7–15 digit phone destination. */
export function buddyPhone(value: string): string | null {
  const text = value.trim();
  if (text.length > 24 || !/^\+?[\d ()-]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${text.startsWith('+') ? '+' : ''}${digits}`;
}

/** Call inside the serialized privacy queue: read current contacts at execution, not click time. */
export async function mutateBuddyCollection(
  change: { kind: 'save'; buddy: Buddy } | { kind: 'remove'; id: string },
  deps: {
    current: () => Buddy[];
    put: (buddy: Buddy) => Promise<void>;
    remove: (id: string) => Promise<void>;
    index: (ids: string[]) => Promise<void>;
    commit: (contacts: Buddy[]) => void;
    isCurrent: () => boolean;
  },
) {
  const contacts = deps.current(),
    id = change.kind === 'save' ? change.buddy.id : change.id;
  const prior = contacts.find((b) => b.id === id);
  if (change.kind === 'save' && !prior && contacts.length >= 5)
    throw new Error('This scaffold supports up to five trusted contacts.');
  const next = [
    ...contacts.filter((b) => b.id !== id),
    ...(change.kind === 'save' ? [change.buddy] : []),
  ];
  try {
    if (change.kind === 'save') await deps.put(change.buddy);
    else await deps.remove(id);
    await deps.index(next.map((b) => b.id));
  } catch (error) {
    // Keep the encrypted record/index consistent when one of the writes fails.
    try {
      if (prior) await deps.put(prior);
      else await deps.remove(id);
    } catch {}
    throw error;
  }
  if (deps.isCurrent()) deps.commit(next);
}
