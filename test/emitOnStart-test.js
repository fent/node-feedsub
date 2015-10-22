var FeedSub = require('..')
  , nock = require('nock')
  , assert = require('assert')
  , path = require('path')


var feedold = path.join(__dirname, 'assets', 'feedold.xml')


describe('Read feed without emitOnStart', function() {
  var host = 'http://feedburner.net'
    , path = '/rss/feedme.xml'
    , reader = new FeedSub(host + path, { emitOnStart: false })
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
    .replyWithFile(200, feedold)

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);

      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 1);

      done();
    });
  });
});


describe('Read with emitOnStart', function() {
  var host = 'http://feedburner.net'
    , path = '/rss/feedme.xml'
    , reader = new FeedSub(host + path, { emitOnStart: true })
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
    .replyWithFile(200, feedold)

  it('Should return some items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997);

      assert.equal(itemCount, 2997);
      assert.equal(itemsEvents, 1);

      done();
    });
  });
});
