var FeedSub = require('..')
  , nock = require('nock')
  , assert = require('assert')
  , path = require('path')


var file1 = path.join(__dirname, 'assets', 'googlefeed.xml')
  , file2 = path.join(__dirname, 'assets', 'googlefeedupdated.xml')


describe('Read all published/updated items with readEveryItem', function() {

  var host = 'https://www.blogger.com'
    , path = '/feeds/10861780/posts/default'
    , reader = new FeedSub(host + path, {
        emitOnStart: true, readEveryItem: true
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

  it('Should return all items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 6);
      assert.equal(itemCount, 6);
      assert.equal(itemsEvents, 1);
      itemCount = 0;
      itemsEvents = 0;
      done();
    });
  });
  
  describe('Read updated feed', function() {
    nock(host)
      .get(path)
      .replyWithFile(200, file2)

    it('Should return all updated items', function(done) {
      reader.read(function(err, items) {
        if (err) throw err;
        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 3);
        assert.equal(itemCount, 3);
        assert.equal(itemsEvents, 1);
        done();
      });
    });
  });
  
});
