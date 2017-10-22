const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const muk     = require('muk');
const assert  = require('assert');
const path    = require('path');


const file1 = path.join(__dirname, 'assets', 'aninews.rss');
const file2 = path.join(__dirname, 'assets', 'nodeblog.xml');

/* jshint freeze:true */


describe('Use skipHours', () => {
  // Mock Date.
  before(() => {
    muk(Date.prototype, 'getHours', () => 4);
  });

  var host = 'http://www.google.com';
  var path = '/reader/public/atom/';
  var reader = new FeedSub(host + path, {
    emitOnStart: true, skipHours: true
  });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

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

  var host = 'http://blog.nodejs.org';
  var path = '/feed/';
  var reader = new FeedSub(host + path, {
    emitOnStart: true, skipDays: true
  });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

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
