var FeedSub = require('..');
var nock    = require('nock');
var sinon   = require('sinon');
var assert  = require('assert');
var path    = require('path');


var file1 = path.join(__dirname, 'assets', 'aninews.rss');
var file2 = path.join(__dirname, 'assets', 'nodeblog.xml');

/* jshint freeze:true */


describe('Use skipHours', function() {
  // Mock Date.
  var lastDate = Date;
  before(function() {
    Date = function() {
      return {
        getHours: function() {
          return 4;
        }
      };
    };
    Date.now = lastDate.now;
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
      if (err) throw err;
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemSpy.callCount, 0);
      assert.equal(itemsSpy.callCount, 1);

      done();
    });
  });

  after(function() {
    Date = lastDate;
  });
});


describe('Use skipDays', function() {
  // Mock Date.
  var lastDate = Date;
  before(function() {
    Date = function() {
      return {
        getDay: function() {
          return 6; // Saturday
        }
      };
    };
    Date.now = lastDate.now;
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
      if (err) throw err;
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemSpy.callCount, 0);
      assert.equal(itemsSpy.callCount, 1);

      done();
    });
  });

  after(function() {
    Date = lastDate;
  });
});
