const FeedSub = require('..');
const nock    = require('nock');
const muk     = require('muk');
const assert  = require('assert');
const path    = require('path');


describe('Use skipHours', () => {
  const feed = path.join(__dirname, 'assets', 'skiphours.rss');
  describe('With hours that match time now', () => {
    it('Should return no items', (done) => {
      muk(Date.prototype, 'getHours', () => 4);
      after(muk.restore);
      const host = 'http://www.google.com';
      const path = '/reader/public/atom/';
      const reader = new FeedSub(host + path, {
        emitOnStart: true, skipHours: true
      });

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, feed);

      reader.read((err, items) => {
        assert.ifError(err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);
        scope.done();
        done();
      });
    });
  });

  describe('With hours that don\'t match', () => {
    it('Should return some items', (done) => {
      muk(Date.prototype, 'getHours', () => 7);
      after(muk.restore);
      const host = 'http://www.google.com';
      const path = '/reader/public/atom/';
      const reader = new FeedSub(host + path, {
        emitOnStart: true, skipHours: true
      });

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, feed);

      reader.read((err, items) => {
        assert.ifError(err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 20);
        scope.done();
        done();
      });
    });
  });
});

describe('Use skipDays', () => {
  const feed = path.join(__dirname, 'assets', 'skipdays.xml');

  it('Should return no items', (done) => {
    muk(Date.prototype, 'getDay', () => 6);
    after(muk.restore);
    const host = 'http://blog.nodejs.org';
    const path = '/feed/';
    const reader = new FeedSub(host + path, {
      emitOnStart: true, skipDays: true
    });

    const scope = nock(host)
      .get(path)
      .replyWithFile(200, feed);

    reader.read((err, items) => {
      assert.ifError(err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      scope.done();
      done();
    });
  });
});
