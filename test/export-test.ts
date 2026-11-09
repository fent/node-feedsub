import assert from 'node:assert';
import FeedSub, { FeedSub as NamedFeedSub } from '..';

describe('Exports', () => {
  it('Exposes class as default and named export', () => {
    assert.strictEqual(FeedSub, NamedFeedSub);
    assert.strictEqual(FeedSub.FeedSub, FeedSub);
    assert.strictEqual(FeedSub.default, FeedSub);
  });
});
