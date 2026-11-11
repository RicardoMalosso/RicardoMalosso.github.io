import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContent} from '../scripts/content.mjs';
import {loadSupabaseContent} from '../scripts/supabase-content.mjs';
test('Supabase import preserves every published article, player and note',{skip:process.env.TEST_SUPABASE!=='1'},async()=>{
 const normalize=entries=>entries.map(e=>({...e,draft:e.draft??false}));
 assert.deepEqual(normalize(await loadSupabaseContent()),normalize(loadContent()));
});
