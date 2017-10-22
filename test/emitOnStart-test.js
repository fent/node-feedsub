const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const assert  = require('assert');
const path    = require('path');


const feedold = path.join(__dirname, 'assets', 'feedold.xml');


describe('Read feed without emitOnStart', () => {
  var host = 'http://feedburner.net';
  var path = '/rss/feedme.xml';
  var reader = new FeedSub(host + path, { emitOnStart: false });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, feedold);

  it('Should return no items', (done) => {
    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);

      assert.equal(itemSpy.callCount, 0);
      assert.equal(itemsSpy.callCount, 1);

      done();
    });
  });
});


describe('Read with emitOnStart', () => {
  var host = 'http://feedburner.net';
  var path = '/rss/feedme.xml';
  var reader = new FeedSub(host + path, { emitOnStart: true });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, feedold);

  it('Should return some items', (done) => {
    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997);

      assert.equal(itemSpy.callCount, 2997);
      assert.equal(itemsSpy.callCount, 1);

      done();
    });
  });
});
