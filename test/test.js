var FeedSub = require('./../lib/feedsub');
       nock = require('nock');


exports['Read the old rss feed first'] = function(beforeExit, assert) {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
    , reader = new FeedSub(host + path, { emitOnStart: true })
    , callbackCount = 0
    , itemCount = 0
    , itemsEvents = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/feedold.xml')

  reader.on('item', function(item) {
    itemCount++;
  });

  reader.on('items', function(items) {
    itemsEvents++;
    var n = itemsEvents === 1 ? 2997 : 3;
    assert.eql(items.length, n);
  });

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++callbackCount, 1);
    assert.isNull(err);
    assert.eql(items.length, 2997, 'read all items in feed');

    // read feed again
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/feedold.xml')

    reader.read(function(err, items) {
      if (err) throw err;
      assert.eql(++callbackCount, 2);
      assert.isNull(err);
      assert.eql(items.length, 0, 'should not return any new items');

      // read the new feed this time
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/feednew.xml')

      reader.read(function(err, items) {
        if (err) throw err;
        assert.eql(++callbackCount, 3);
        assert.isNull(err);
        assert.eql(items.length, 3, '3 new items');
      });

    });

  });

  beforeExit(function() {
    assert.eql(callbackCount, 3);
    assert.eql(itemCount, 3000);
    assert.eql(itemsEvents, 2);
  });
};

exports['Read feed without emitOnStart'] = function(beforeExit, assert) {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
    , reader = new FeedSub(host + path, { emitOnStart: false })
    , callbackCount = 0
    , itemCount = 0
    , itemsEvents = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/feedold.xml')

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++callbackCount, 1);
    assert.isNull(err);
    assert.eql(items.length, 0, 'should return no items');
  });

  beforeExit(function() {
    assert.eql(callbackCount, 1);
    assert.eql(itemCount, 0);
    assert.eql(itemsEvents, 0);
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
    , reader = new FeedSub(host + path, {
        emitOnStart: true, skipHours: true
      })
    , callbackCount = 0
    , itemCount = 0
    , itemsEvents = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/aninews.rss')

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++callbackCount, 1);
    assert.isNull(err);
    assert.eql(items.length, 0, 'should return no items');
  });

  beforeExit(function() {
    assert.eql(callbackCount, 1);
    assert.eql(itemCount, 0);
    assert.eql(itemsEvents, 0);
  });
};


exports['Same title but different pubdate'] = function(beforeExit, assert) {
  var host = 'http://feedburner.info'
    , path = '/rss'
    , reader = new FeedSub(host + path, { emitOnStart: true })
    , callbackCount = 0
    , itemCount = 0
    , itemsEvents = 0
    ;

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/rss2old.xml')

  reader.on('item', function() {
    itemCount++;
  });

  reader.on('items', function() {
    itemsEvents++;
  });

  reader.read(function(err, items) {
    if (err) throw err;
    assert.eql(++callbackCount, 1);
    assert.isNull(err);
    assert.eql(items.length, 4, 'read all items in feed');

    // read feed again
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/rss2old.xml')

    reader.read(function(err, items) {
      if (err) throw err;
      assert.eql(++callbackCount, 2);
      assert.isNull(err);
      assert.eql(items.length, 0, 'should not return any new items');

      // read the new feed this time
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/rss2new.xml')

      reader.read(function(err, items) {
        if (err) throw err;
        assert.eql(++callbackCount, 3);
        assert.isNull(err);
        assert.eql(items.length, 1, '1 new item with different pubdate');
      });
    });
  });

  beforeExit(function() {
    assert.eql(callbackCount, 3);
    assert.eql(itemCount, 5);
    assert.eql(itemsEvents, 2);
  });
};
