const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const muk     = require('muk');
const assert  = require('assert');
const path    = require('path');


const file1 = path.join(__dirname, 'assets', 'aninews.rss');
const file2 = path.join(__dirname, 'assets', 'nodeblog.xml');

describe('Use skipHours', () => {
  // Mock Date.
  before(() => {
    muk(Date.prototype, 'getHours', () => 4);
  });

  const host = 'http://www.google.com';
  const path = '/reader/public/atom/';
  const reader = new FeedSub(host + path, {
    emitOnStart: true, skipHours: true
  });
  const itemSpy = sinon.spy();
  const itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, file1);

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

  after(muk.restore);
});


describe('Use skipDays', () => {
  // Mock Date.
  before(() => {
    muk(Date.prototype, 'getDay', () => 6);
  });

  const host = 'http://blog.nodejs.org';
  const path = '/feed/';
  const reader = new FeedSub(host + path, {
    emitOnStart: true, skipDays: true
  });
  const itemSpy = sinon.spy();
  const itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, file2);

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

  after(muk.restore);
});
