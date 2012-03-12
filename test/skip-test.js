var FeedSub = require('..')
  , nock = require('nock')
  , assert = require('assert')
  , path = require('path')


var file1 = path.join(__dirname, 'aninews.rss')
  , file2 = path.join(__dirname, 'nodeblog.xml')


describe('Use skipHours', function() {
  // mock Date
  var lastDate = Date;
  before(function() {
    Date = function() {
      return {
        getHours: function() {
          return 4;
        }
      };
    };
  });

  var host = 'http://www.google.com'
    , path = '/reader/public/atom/'
    , reader = new FeedSub(host + path, {
        emitOnStart: true, skipHours: true
      })
    , itemCount = 0
    , itemsEvents = 0

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });

  nock(host)
    .get(path)
    .replyWithFile(200, file1)

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 1);

      done();
    });
  });

  after(function() {
    Date = lastDate;
  });
});


describe('Use skipDays', function() {
  // mock Date
  var lastDate = Date;
  before(function() {
    Date = function() {
      return {
        getDay: function() {
          return 6; // Saturday
        }
      };
    };
  });

  var host = 'http://blog.nodejs.org'
    , path = '/feed/'
    , reader = new FeedSub(host + path, {
        emitOnStart: true, skipDays: true
      })
    , itemCount = 0
    , itemsEvents = 0

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });

  nock(host)
    .get(path)
    .replyWithFile(200, file2)

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 1);

      done();
    });
  });

  after(function() {
    Date = lastDate;
  });
});
