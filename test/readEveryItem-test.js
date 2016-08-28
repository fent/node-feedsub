var FeedSub = require('..');
var nock    = require('nock');
var sinon   = require('sinon');
var assert  = require('assert');
var path    = require('path');


var file1 = path.join(__dirname, 'assets', 'googlefeed.xml');
var file2 = path.join(__dirname, 'assets', 'googlefeedupdated.xml');


describe('Read all published/updated items with readEveryItem', function() {

  var host = 'https://www.blogger.com';
  var path = '/feeds/10861780/posts/default';
  var reader = new FeedSub(host + path, {
    emitOnStart: true, readEveryItem: true
  });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, file1);

  it('Should return all items', function(done) {
    reader.read(function(err, items) {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 6);
      assert.equal(itemSpy.callCount, 6);
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.reset();
      itemsSpy.reset();

      done();
    });
  });
  
  describe('Read updated feed', function() {
    nock(host)
      .get(path)
      .replyWithFile(200, file2);

    it('Should return all updated items', function(done) {
      reader.read(function(err, items) {
        if (err) return done(err);

        assert.ok(Array.isArray(items));
        assert.equal(items.length, 3);
        assert.equal(itemSpy.callCount, 3);
        assert.equal(itemsSpy.callCount, 1);
        done();
      });
    });
  });
  
});
