import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pronunciationGuides } from '../src/pronunciationGuides.ts';

test('pronunciation guides point to distinct, nonempty public audio assets', async () => {
  for (const [route, clips] of Object.entries(pronunciationGuides)) {
    assert.match(route, /^(music|blog)\/[^/]+\/(en|pt-br)$/);
    assert.ok(clips.length > 0);
    assert.equal(new Set(clips.map(clip => clip.audio)).size, clips.length);
    for (const clip of clips) {
      assert.ok(clip.term.trim());
      assert.ok(clip.respelling.trim());
      assert.match(clip.audio, /^audio\/pronunciation\/[a-z0-9-]+\.mp3$/);
      const file = await stat(join('public', clip.audio));
      assert.ok(file.size > 1000, `${clip.audio} is empty or truncated`);
    }
  }
});
