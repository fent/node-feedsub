const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const assert  = require('assert');
const join    = require('path').join;


const rss2old = join(__dirname, 'assets', 'rss2old.xml');


describe('Conditional GET', () => {
  const host = 'http://feedburner.info';
  const path = '/rss';

  // Reply with headers.
  let now = new Date().toGMTString();
  let etag = '"asdfghjklpoiuytrewq"';
  let headers = { 'last-modified': now, 'etag': etag };

  it('Should not return new items on second read', (done) => {
    let scope1 = nock(host)
      .get(path)
      .replyWithFile(200, rss2old, headers);

    const reader = new FeedSub(host + path, { emitOnStart: true });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    reader.read((err, items) => {
      assert.ifError(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemSpy.callCount, 4);
      assert.equal(itemsSpy.callCount, 1);

      assert.equal(reader.getOpts.headers['If-Modified-Since'], now);
      assert.equal(reader.getOpts.headers['If-None-Match'], etag);

      itemSpy.resetHistory();
      itemsSpy.resetHistory();

      scope1.done();

      let scope2 = nock(host)
        .get(path)
        .matchHeader('if-modified-since', now)
        .matchHeader('if-none-match', etag)
        .replyWithFile(304, rss2old, headers);

      reader.read((err, items) => {
        assert.ifError(err);

        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemSpy.callCount, 0);
        assert.equal(itemsSpy.callCount, 1);

        scope2.done();
        done();
      });
    });
  });
});
