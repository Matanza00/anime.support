import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterItems, similarity, slugify, clusterKeyFor } from '../src/text.js';
import { scoreCluster } from '../src/draft.js';

test('slugify makes clean URLs', () => {
  assert.equal(slugify('Frieren Season 2: January Premiere & New Visual!'), 'frieren-season-2-january-premiere-new-visual');
  assert.equal(slugify('Café Ōkami'), 'cafe-okami');
});

test('same story from two outlets clusters together', () => {
  const items = [
    { id: 1, title: 'Jujutsu Kaisen Season 3 Adds Soma Saito and Ari Ozawa to Cast' },
    { id: 2, title: 'One Piece Anime Announces Egghead Arc Break' },
    { id: 3, title: 'Jujutsu Kaisen Season 3 Cast Adds Soma Saito, Ari Ozawa' },
  ];
  const clusters = clusterItems(items);
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters.find((c) => c.length === 2).map((i) => i.id), [1, 3]);
});

test('different stories about the same anime stay separate', () => {
  const s = similarity('Jujutsu Kaisen Season 3 Adds Two Cast Members', 'Jujutsu Kaisen Manga Sells 100 Million Copies');
  assert.ok(s < 0.6, `similarity ${s} should be below threshold`);
});

test('cluster key is order independent', () => {
  assert.equal(clusterKeyFor('Frieren Season 2 Premiere Date'), clusterKeyFor('Premiere date: Frieren season 2'));
});

test('popular anime and multi-outlet stories score higher', () => {
  const now = new Date().toISOString();
  const focus = [{ name: 'Frieren', weight: 2.5 }];
  const frieren = [{ title: 'Frieren Season 2 Premiere Date', source_id: 1, published_at: now }];
  const other = [{ title: 'Some Other Show Gets Visual', source_id: 1, published_at: now }];
  const twoOutlets = [
    { title: 'Some Other Show Gets Visual', source_id: 1, published_at: now },
    { title: 'Some Other Show Visual Revealed', source_id: 2, published_at: now },
  ];
  assert.ok(scoreCluster(frieren, focus) > scoreCluster(other, focus));
  assert.ok(scoreCluster(twoOutlets, focus) > scoreCluster(other, focus));
});

test('long official titles still match short headlines', () => {
  const now = new Date().toISOString();
  const focus = [{ name: "Frieren: Beyond Journey's End", weight: 2 }];
  const c = [{ title: 'Frieren Season 2 Premiere Date', source_id: 1, published_at: now }];
  const other = [{ title: 'Some Other Show Visual', source_id: 1, published_at: now }];
  assert.ok(scoreCluster(c, focus) > scoreCluster(other, focus));
});
