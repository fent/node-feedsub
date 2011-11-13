var FeedSub = require('./../lib/feedsub');
       nock = require('nock');


exports['Read the old rss feed first'] = function(beforeExit, assert) {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
    , reader = new FeedSub(host + path, { interval: 3 })
    , n = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/feedold.xml')

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++n, 1);
    assert.isNull(err);
    assert.eql(items.length, 2997, 'read all items in feed');

    // read feed again
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/feedold.xml')

    reader.read(function(err, items) {
      if (err) throw err;
      assert.eql(++n, 2);
      assert.isNull(err);
      assert.eql(items.length, 0, 'should not return any new items');

      // read the new feed this time
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/feednew.xml')

      reader.read(function(err, items) {
        if (err) throw err;
        assert.eql(++n, 3);
        assert.isNull(err);
        assert.eql(items.length, 3, '3 new items');
      });
    });
  });
};

exports['Read feed without emitOnStart'] = function(beforeExit, assert) {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
    , reader = new FeedSub(host + path, { emitOnStart: false })
    , n = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/feedold.xml')

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++n, 1);
    assert.isNull(err);
    assert.eql(items.length, 0, 'should return no items');
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

  var host = 'http://www.google.com'
    , path = '/reader/public/atom/'
    , reader = new FeedSub(host + path, { skipHours: true })
    , n = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/aninews.rss')

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++n, 1);
    assert.isNull(err);
    assert.eql(items.length, 0, 'should return no items');
  });
};


exports['Same title but different pubdate'] = function(beforeExit, assert) {
  var host = 'http://feedburner.info'
    , path = '/rss'
    , reader = new FeedSub(host + path)
    , n = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/rss2old.xml')

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++n, 1);
    assert.isNull(err);
    assert.eql(items.length, 4, 'read all items in feed');

    // read feed again
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/rss2old.xml')

    reader.read(function(err, items) {
      if (err) throw err;
      assert.eql(++n, 2);
      assert.isNull(err);
      assert.eql(items.length, 0, 'should not return any new items');

      // read the new feed this time
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/rss2new.xml')

      reader.read(function(err, items) {
        if (err) throw err;
        assert.eql(++n, 3);
        assert.isNull(err);
        assert.eql(items.length, 1, '1 new item with different pubdate');
      });
    });
  });
};
