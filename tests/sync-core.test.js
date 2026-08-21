'use strict';

const assert = require('node:assert/strict');
const { mergeEntries } = require('../sync-core.js');

function entry(id, amount, extra) {
  return { id, amount, date: '2026-08-21', type: 'expense', ...(extra || {}) };
}

{
  const result = mergeEntries({ A: [] }, [{ book: 'A', entry: entry('r1', 100) }], new Set());
  assert.equal(result.added, 1);
  assert.deepEqual(result.entriesByBook.A, [entry('r1', 100)]);
}

{
  const result = mergeEntries(
    { A: [entry('same', 100), entry('local-only', 50)] },
    [{ book: 'A', entry: entry('same', 200) }],
    new Set()
  );
  assert.equal(result.updated, 1);
  assert.deepEqual(result.entriesByBook.A, [entry('same', 200), entry('local-only', 50)]);
}

{
  const result = mergeEntries(
    { A: [entry('pending', 100)] },
    [{ book: 'A', entry: entry('pending', 999) }],
    new Set(['pending'])
  );
  assert.equal(result.protected, 1);
  assert.equal(result.entriesByBook.A[0].amount, 100);
}

{
  const result = mergeEntries(
    { A: [] },
    [{ book: 'A', entry: entry('failed-delete', 100) }],
    new Set(['failed-delete'])
  );
  assert.equal(result.protected, 1);
  assert.equal(result.entriesByBook.A.length, 0);
}

{
  const result = mergeEntries(
    { A: [entry('moved', 100)] },
    [{ book: 'B', entry: entry('moved', 100) }],
    new Set()
  );
  assert.equal(result.entriesByBook.A.length, 0);
  assert.deepEqual(result.entriesByBook.B, [entry('moved', 100)]);
}

{
  const result = mergeEntries(
    { A: [entry('dup', 1), entry('dup', 2)] },
    [],
    new Set()
  );
  assert.equal(result.duplicateLocal, 1);
  assert.deepEqual(result.entriesByBook.A, [entry('dup', 1)]);
}

{
  const result = mergeEntries(
    { A: [] },
    [{ book: 'A', entry: entry('', 1) }],
    new Set()
  );
  assert.equal(result.invalidRemote, 1);
  assert.equal(result.entriesByBook.A.length, 0);
}

console.log('sync-core: all tests passed');
