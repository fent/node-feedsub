var FeedSub = require('..')
  , nock = require('nock')
  , assert = require('assert')
  , path = require('path')


var rss2old = path.join(__dirname, 'assets', 'rss2old.xml')


describe('Conditional GET', function() {
  var host = 'http://feedburner.info'
    , path = '/rss'
    , reader = new FeedSub(host + path, { emitOnStart: true })
    , itemCount = 0
    , itemsEvents = 0

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });


  // reply with headers
  var now = new Date().toGMTString();
  var etag = '"asdfghjklpoiuytrewq"';
  var headers = {
      'last-modified': now
    , 'etag': etag
  };
  nock(host)
    .get(path)
    .replyWithFile(200, rss2old, headers)

  it('Read all items in feed', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemCount, 4);
      assert.equal(itemsEvents, 1);

      assert.equal(reader.getOpts.headers['If-Modified-Since'], now);
      assert.equal(reader.getOpts.headers['If-None-Match'], etag);

      itemCount = 0;
      itemsEvents = 0;

      done();
    });
  });


  describe('Read feed again', function() {
    nock(host)
      .get(path)
      .matchHeader('if-modified-since', now)
      .matchHeader('if-none-match', etag)
      .replyWithFile(304, rss2old, headers)

    it('Should not return any new items', function(done) {
      reader.read(function(err, items) {
        if (err) throw err;
        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemCount, 0);
        assert.equal(itemsEvents, 1);

        itemCount = 0;
        itemsEvents = 0;

        done();
      });
    });

  });
});
