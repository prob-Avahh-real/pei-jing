import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('pei-jing smoke', () => {
  it('has acuity module source', () => {
    const p = path.join(process.cwd(), 'src', 'acuity.js');
    assert.ok(fs.existsSync(p));
    const text = fs.readFileSync(p, 'utf8');
    assert.ok(text.length > 50);
  });
});
