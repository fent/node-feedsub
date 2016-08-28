var FeedSub = require('..');
var nock    = require('nock');
var sinon   = require('sinon');
var muk     = require('muk');
var assert  = require('assert');
var path    = require('path');


var file1 = path.join(__dirname, 'assets', 'aninews.rss');
var file2 = path.join(__dirname, 'assets', 'nodeblog.xml');

/* jshint freeze:true */


describe('Use skipHours', function() {
  // Mock Date.
  before(function() {
    muk(Date.prototype, 'getHours', function() { return 4; });
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

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
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


describe('Use skipDays', function() {
  // Mock Date.
  before(function() {
    muk(Date.prototype, 'getDay', function() { return 6; });
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

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
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
