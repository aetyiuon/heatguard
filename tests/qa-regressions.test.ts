import { Buddy } from '../src/domain/types';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buddyPhone, mutateBuddyCollection } from '../src/domain/buddy';
import { reliefMapRegion } from '../src/domain/mapRegion';
import { outfitSignature, saveOutfit, SavedOutfit } from '../src/domain/outfits';
import {
  createPrivateMutationQueue,
  createLocalWriteQueue,
  createMonitoringController,
  MonitoringConfig,
} from '../src/domain/mutations';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('buddy destinations require actual digits rather than punctuation or an unusable short code', () => {
  for (const phone of [
    '-------',
    '()()()()',
    '       ',
    '123-45',
    '+',
    '+1234567890123456',
    '+1555?body=unexpected',
    'abc5550100',
  ])
    assert.equal(buddyPhone(phone), null);
  assert.equal(buddyPhone('+1 (555) 010-0200'), '+15550100200');
  assert.equal(buddyPhone(' 555-0100 '), '5550100');
});
test('native map point focus wins over whole-city bounds, including equator/prime meridian', () => {
  const place = { latitude: 32.7, longitude: -97.1 },
    bounds: [number, number, number, number] = [-98, 32, -96, 34];
  assert.deepEqual(reliefMapRegion(place, { latitude: 0, longitude: 0 }, bounds), {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  assert.equal(reliefMapRegion(place, undefined, bounds).latitude, 33);
  assert.equal(
    reliefMapRegion(place, { latitude: 5, longitude: 5, bounds: [4, 4, 6, 6] }, bounds).latitude,
    5,
  );
});
test('saving a padded outfit name updates the existing outfit instead of duplicating its key', () => {
  const old: SavedOutfit = { name: 'Fixture outfit', activity: 'running', items: ['water'] };
  const next = saveOutfit([old], {
    name: '  Fixture outfit  ',
    activity: 'commuting',
    items: ['sun', 'water'],
  });
  assert.equal(next.length, 1);
  assert.equal(next[0]!.name, 'Fixture outfit');
  assert.equal(next[0]!.activity, 'commuting');
  assert.deepEqual(old.items, ['water']);
});
test('outfit saved confirmation remains bound to the saved snapshot when edits happen during a save', () => {
  const original: SavedOutfit = { name: 'Fixture', activity: 'running', items: ['water'] };
  const saved = outfitSignature(original);
  assert.notEqual(outfitSignature({ ...original, name: 'Unsaved edit' }), saved);
  assert.notEqual(outfitSignature({ ...original, items: ['water', 'sun'] }), saved);
  assert.notEqual(outfitSignature({ ...original, activity: 'commuting' }), saved);
  assert.equal(outfitSignature({ ...original, name: ' Fixture ' }), saved);
  assert.equal(
    saveOutfit(
      Array.from({ length: 6 }, (_, i) => ({ ...original, name: String(i) })),
      original,
    ).length,
    5,
  );
});

test('erase drains a private write, discards queued old writes and preserves new post-erase saves', async () => {
  const q = createPrivateMutationQueue(),
    first = deferred<void>();
  const data = new Map<string, string>();
  const old = q.run(async () => {
    await first.promise;
    data.set('fixture', 'old');
  });
  await new Promise((resolve) => setImmediate(resolve));
  const queued = q.run(async () => {
    data.set('queued', 'must not return');
  });
  const cleared = q.beginClear();
  await assert.rejects(
    q.run(async () => {}),
    /deletion/,
  );
  first.resolve();
  await cleared;
  data.clear();
  q.endClear();
  const fresh = q.run(async () => {
    data.set('fixture', 'new');
  });
  assert.equal(await old, false);
  assert.equal(await queued, false);
  assert.equal(await fresh, true);
  assert.deepEqual([...data], [['fixture', 'new']]);
});
const config = (name: string): MonitoringConfig => ({
  enabled: true,
  place: { name, latitude: 0, longitude: 0, emergencyNumber: '112' },
  workload: 'light',
  threshold: 2,
  language: 'en',
});
test('a pending monitor enable is disabled before a newer enabled context can register', async () => {
  const enable = deferred<void>(),
    cleanup = deferred<void>();
  let current: MonitoringConfig | null = null;
  const events: string[] = [];
  const c = createMonitoringController({
    current: () => current,
    commit: (v) => {
      current = v;
    },
    apply: async (v: MonitoringConfig) => {
      events.push(`${v.enabled ? 'enable' : 'disable'}-${v.place.name}`);
      if (v.place.name === 'old' && v.enabled) await enable.promise;
      if (v.place.name === 'old' && !v.enabled) await cleanup.promise;
    },
  });
  const old = c.set(config('old'));
  await new Promise((resolve) => setImmediate(resolve));
  const disabled = c.set({ ...config('clear'), enabled: false });
  enable.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  const fresh = c.set(config('new'));
  assert.deepEqual(events, ['enable-old', 'disable-old']);
  cleanup.resolve();
  await Promise.all([old, disabled, fresh]);
  assert.deepEqual(events, ['enable-old', 'disable-old', 'enable-new']);
  assert.equal((current as MonitoringConfig | null)?.place.name, 'new');
  assert.equal((current as MonitoringConfig | null)?.enabled, true);
});
test('pending monitoring uses the latest selected workload rather than the stale permission snapshot', async () => {
  const first = deferred<void>();
  let calls = 0,
    current: MonitoringConfig | null = null;
  const c = createMonitoringController({
    current: () => current,
    commit: (v) => {
      current = v;
    },
    apply: async () => {
      if (++calls === 1) await first.promise;
    },
  });
  const old = c.set(config('fixture'));
  await new Promise((resolve) => setImmediate(resolve));
  const updated = c.update({ workload: 'heavy' });
  first.resolve();
  await Promise.all([old, updated]);
  assert.equal((current as MonitoringConfig | null)?.workload, 'heavy');
});
test('a partially failed monitoring enable is disabled and cannot silently retry when language changes', async () => {
  let current: MonitoringConfig | null = null,
    enabledCalls = 0;
  const c = createMonitoringController({
    current: () => current,
    commit: (v) => {
      current = v;
    },
    apply: async (v: MonitoringConfig) => {
      if (v.enabled) {
        enabledCalls++;
        throw new Error('Fixture write failure');
      }
    },
  });
  await assert.rejects(c.set(config('fixture')), /Fixture write failure/);
  assert.equal((current as MonitoringConfig | null)?.enabled, false);
  await c.update({ language: 'es' });
  assert.equal(enabledCalls, 1);
});

test('a late pre-erase cache request cannot recreate erased coordinates or remove a newer cache', async () => {
  const q = createLocalWriteQueue(),
    data = new Map<string, string>();
  const oldVersion = q.version;
  await q.write(async () => {
    data.set('old-location', 'old');
  }, oldVersion);
  await q.clear(async () => {
    data.clear();
  });
  await q.write(async () => {
    data.set('new-location', 'fresh');
  });
  await q.write(async () => {
    data.set('old-location', 'late old response');
  }, oldVersion);
  assert.deepEqual([...data], [['new-location', 'fresh']]);
});
test('overlapping contact add/remove operations preserve the current index without orphaning records', async () => {
  const initial: Buddy = {
    id: 'a',
    name: 'Fictional fixture A',
    phone: '5550100',
    neighbor: false,
    checkInMinutes: 30,
  };
  const added: Buddy = { ...initial, id: 'b', name: 'Fictional fixture B' };
  let collection = [initial],
    index = ['a'];
  const records = new Map([['a', initial]]),
    first = deferred<void>();
  const q = createPrivateMutationQueue();
  const apply = (change: Parameters<typeof mutateBuddyCollection>[0]) =>
    q.run((current) =>
      mutateBuddyCollection(change, {
        current: () => collection,
        put: async (b) => {
          if (b.id === 'b') await first.promise;
          records.set(b.id, b);
        },
        remove: async (id) => {
          records.delete(id);
        },
        index: async (ids) => {
          index = ids;
        },
        commit: (next) => {
          collection = next;
        },
        isCurrent: current,
      }),
    );
  const save = apply({ kind: 'save', buddy: added });
  await new Promise((resolve) => setImmediate(resolve));
  const remove = apply({ kind: 'remove', id: 'a' });
  first.resolve();
  await Promise.all([save, remove]);
  assert.deepEqual(
    collection.map((b) => b.id),
    ['b'],
  );
  assert.deepEqual(index, ['b']);
  assert.deepEqual([...records.keys()], ['b']);
});
test('a failed contact-index write rolls back a new private record without a false saved state', async () => {
  const b: Buddy = {
    id: 'fixture',
    name: 'Fictional fixture',
    phone: '5550100',
    neighbor: false,
    checkInMinutes: 30,
  };
  const records = new Map<string, Buddy>();
  let committed = false;
  await assert.rejects(
    mutateBuddyCollection(
      { kind: 'save', buddy: b },
      {
        current: () => [],
        put: async (b) => {
          records.set(b.id, b);
        },
        remove: async (id) => {
          records.delete(id);
        },
        index: async () => {
          throw new Error('Fixture index failure');
        },
        commit: () => {
          committed = true;
        },
        isCurrent: () => true,
      },
    ),
    /index failure/,
  );
  assert.equal(records.size, 0);
  assert.equal(committed, false);
});
