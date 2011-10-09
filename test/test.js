var FeedSub = require('./../lib/feedsub');
          nock = require('nock');


nock('http://feedsite.info')
  .get('/rss/feedold.xml')
  .replyWithFile(200, __dirname + '/feedold.xml')
  .get('/rss/feednew.xml')
  .replyWithFile(200, __dirname + '/feednew.xml')

nock('http://www.google.com')
  .get('/reader/public/atom/')
  .replyWithFile(200, __dirname + '/aninews.rss')


var feed1old = 'http://feedsite.info/rss/feedold.xml',
    feed1new = '/rss/feednew.xml',
    feed2    = 'http://www.google.com/reader/public/atom/';


exports['Read the old rss feed'] = function(beforeExit, assert) {
  var reader = new FeedSub(feed1old, { interval: 3 });
  var n = 0;

  reader.read(function(err, items) {
    assert.equal(++n, 1);
    assert.isNull(err);
    assert.length(items, 2997, 'read all items in feed');

    // read feed again
    reader.read(function(err, items) {
      assert.equal(++n, 2);
      assert.isNull(err);
      assert.length(items, 0, 'should not return any new items');

      // read the new feed this time
      reader.getOpt.path = feed1new;
      reader.read(function(err, items) {
        assert.equal(++n, 3);
        assert.isNull(err);
        assert.length(items, 3, '3 new items');
      });
    });
  });
};


exports['Read feed without emitOnStart'] = function(beforeExit, assert) {
  var reader = new FeedSub(feed1old, { emitOnStart: false });
  var n = 0;

  reader.read(function(err, items) {
    assert.equal(++n, 1);
    assert.isNull(err);
    assert.length(items, 0, 'should return no items');
  });
};


exports['Use skipHours'] = function(beforeExit, assert) {
  // mock Date
  Date = function() {
    return {
      getHours: function() {
        return 4;
      }
    };
  };

  var reader = new FeedSub(feed2, { skipHours: true });
  var n = 0;

  reader.read(function(err, items) {
    assert.equal(++n, 1);
    assert.isNull(err);
    assert.length(items, 0, 'should return no items');
  });
};
