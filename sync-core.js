(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LedgerSyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function sameEntry(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Safely merges cloud rows into the PWA data model.
   * - Cloud wins for matching IDs after the local queue has been flushed.
   * - Local-only entries are retained because the backend has no tombstones.
   * - IDs that still have pending/failed local operations are protected.
   */
  function mergeEntries(localByBook, remoteItems, protectedIds) {
    const protectedSet = protectedIds instanceof Set ? protectedIds : new Set(protectedIds || []);
    const remoteById = new Map();
    let invalidRemote = 0;
    let duplicateRemote = 0;

    for (const item of remoteItems || []) {
      const id = item && item.entry && item.entry.id;
      if (!id || !item.book) {
        invalidRemote++;
        continue;
      }
      if (remoteById.has(id)) duplicateRemote++;
      remoteById.set(id, item);
    }

    const entriesByBook = {};
    for (const book of Object.keys(localByBook || {})) entriesByBook[book] = [];

    const seenLocal = new Set();
    const consumedRemote = new Set();
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let protectedCount = 0;
    let duplicateLocal = 0;

    const push = (book, entry) => {
      if (!entriesByBook[book]) entriesByBook[book] = [];
      entriesByBook[book].push(entry);
    };

    for (const [localBook, entries] of Object.entries(localByBook || {})) {
      for (const localEntry of entries || []) {
        const id = localEntry && localEntry.id;
        if (!id) {
          push(localBook, localEntry);
          continue;
        }
        if (seenLocal.has(id)) {
          duplicateLocal++;
          continue;
        }
        seenLocal.add(id);

        const remote = remoteById.get(id);
        if (!remote) {
          push(localBook, localEntry);
          continue;
        }
        consumedRemote.add(id);

        if (protectedSet.has(id)) {
          push(localBook, localEntry);
          protectedCount++;
          continue;
        }

        push(remote.book, remote.entry);
        if (remote.book === localBook && sameEntry(localEntry, remote.entry)) unchanged++;
        else updated++;
      }
    }

    for (const [id, remote] of remoteById.entries()) {
      if (consumedRemote.has(id)) continue;
      if (protectedSet.has(id)) {
        protectedCount++;
        continue;
      }
      push(remote.book, remote.entry);
      added++;
    }

    return {
      entriesByBook,
      added,
      updated,
      unchanged,
      protected: protectedCount,
      invalidRemote,
      duplicateRemote,
      duplicateLocal
    };
  }

  return { mergeEntries };
});
