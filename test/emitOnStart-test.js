const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const assert  = require('assert');
const path    = require('path');


const feedold = path.join(__dirname, 'assets', 'feedold.xml');


describe('Read feed without emitOnStart', () => {
  it('Should return no items', (done) => {
    const host = 'http://feedburner.net';
    const path = '/rss/feedme.xml';
    const reader = new FeedSub(host + path, { emitOnStart: false });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    let scope = nock(host)
      .get(path)
      .replyWithFile(200, feedold);

    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);

      assert.equal(itemSpy.callCount, 0);
      assert.equal(itemsSpy.callCount, 1);

      scope.done();
      done();
    });
  });
});


describe('Read with emitOnStart', () => {
  it('Should return some items', (done) => {
    const host = 'http://feedburner.net';
    const path = '/rss/feedme.xml';
    const reader = new FeedSub(host + path, { emitOnStart: true });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    let scope = nock(host)
      .get(path)
      .replyWithFile(200, feedold);

    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997);

      assert.equal(itemSpy.callCount, 2997);
      assert.equal(itemsSpy.callCount, 1);

      scope.done();
      done();
    });
  });
});
