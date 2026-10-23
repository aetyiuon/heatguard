import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest, Env } from '../backend/app';
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('backend/schema.sql', 'utf8'));
  const adapter = {
    prepare(sql: string) {
      let params: any[] = [];
      const statement = {
        bind(...values: unknown[]) {
          params = values;
          return statement;
        },
        async all() {
          return { results: db.prepare(sql).all(...params) };
        },
        async run() {
          return db.prepare(sql).run(...params);
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return { db, env: { DB: adapter, COMMUNITY_SALT: 'test-only-salt' } as Env };
}
function post(path: string, body: Record<string, unknown>, client = 'test-client-0000000001') {
  return new Request(`https://fixture${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-ID': client },
    body: JSON.stringify({ latitude: 30.267, longitude: -97.743, ...body }),
  });
}
test('community sharing requires explicit consent and never labels user pins official', async () => {
  const { db, env } = fixture();
  try {
    const denied = await handleRequest(
      post('/community/pins', { name: 'Fixture shade', kind: 'shade' }),
      env,
    );
    assert.equal(denied.status, 400);
    const created = await handleRequest(
      post('/community/pins', {
        name: 'Fixture shade',
        kind: 'shade',
        consent: true,
        official: true,
        age: 65,
      }),
      env,
    );
    assert.equal(created.status, 201);
    const read = await handleRequest(
      new Request('https://fixture/community?lat=30.267&lon=-97.743'),
      env,
    );
    const data = await read.json();
    assert.equal(data.pins[0].official, false);
    assert.equal(data.pins[0].age, undefined);
    assert.equal(data.pins[0].status, 'unknown');
  } finally {
    db.close();
  }
});
test('three distinct reporters demote a pin; duplicate votes do not inflate counts', async () => {
  const { db, env } = fixture();
  try {
    const created = await handleRequest(
      post('/community/pins', { name: 'Fixture water', kind: 'water', consent: true }),
      env,
    );
    const { id } = await created.json();
    for (const client of [
      'test-client-0000000001',
      'test-client-0000000001',
      'test-client-0000000002',
      'test-client-0000000003',
    ])
      assert.equal(
        (
          await handleRequest(
            post('/community/vote', { pinId: id, kind: 'report', consent: true }, client),
            env,
          )
        ).status,
        200,
      );
    const read = await handleRequest(
      new Request('https://fixture/community?lat=30.267&lon=-97.743'),
      env,
    );
    const data = await read.json();
    assert.equal(data.pins[0].reports, 3);
    assert.equal(data.pins[0].status, 'not-working');
  } finally {
    db.close();
  }
});
test('community feelings expose coarse location without actor identity', async () => {
  const { db, env } = fixture();
  try {
    assert.equal(
      (
        await handleRequest(
          post('/community/feel', {
            latitude: 30.26789,
            longitude: -97.74321,
            feeling: 'hot',
            consent: true,
          }),
          env,
        )
      ).status,
      201,
    );
    const read = await handleRequest(
      new Request('https://fixture/community?lat=30.267&lon=-97.743'),
      env,
    );
    const data = await read.json();
    assert.equal(data.reports[0].latitude, 30.27);
    assert.equal(data.reports[0].longitude, -97.74);
    assert.equal(data.reports[0].actor, undefined);
  } finally {
    db.close();
  }
});
test('unknown pins cannot accumulate moderation records', async () => {
  const { db, env } = fixture();
  try {
    assert.equal(
      (
        await handleRequest(
          post('/community/vote', { pinId: 'missing', kind: 'report', consent: true }),
          env,
        )
      ).status,
      404,
    );
  } finally {
    db.close();
  }
});
