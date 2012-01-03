var FeedSub = require('..')
  , nock = require('nock')
  , assert = require('assert')


describe('Read the old RSS feed first', function() {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
    , reader = new FeedSub(host + path, { emitOnStart: true })
    , itemCount = 0
    , itemsEvents = 0


  reader.on('item', function(item) {
    itemCount++;
  });

  reader.on('items', function(items) {
    itemsEvents++;
  });

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/feedold.xml')


  it('Reads all items in feed', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997,
                   'Callback gets correct number of items');
      assert.equal(itemCount, 2997,
                   'Correct number of item events emitted');
      assert.equal(itemsEvents, 1);

      itemCount = 0;
      itemsEvents = 0;

      done();
    });
  });


  describe('Read feed again', function() {
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/feedold.xml')

    it('Does not return any new items', function(done) {
      reader.read(function(err, items) {
        if (err) throw err;
        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemCount, 0);
        assert.equal(itemsEvents, 0);

        itemCount = 0;
        itemsEvents = 0;

        done();
      });
    });
      // read the new feed this time

    describe('Read updated feed', function() {
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/feednew.xml')


      it('Returns some new items', function(done) {
        reader.read(function(err, items) {
          if (err) throw err;
          assert.ok(!err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 3, '3 new items');

          assert.equal(itemCount, 3);
          assert.equal(itemsEvents, 1);

          itemCount = 0;
          itemsEvents = 0;

          done();
        });
      });
    });

  });
});


describe('Read feed without emitOnStart', function() {
  var host = 'http://feedsite.info'
    , path = '/rss/feed.xml'
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
    .replyWithFile(200, __dirname + '/feedold.xml')

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);

      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 0);

      done();
    });
  });
});


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
    .replyWithFile(200, __dirname + '/aninews.rss')

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 0);

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
    .replyWithFile(200, __dirname + '/nodeblog.xml')

  it('Should return no items', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      assert.equal(itemCount, 0);
      assert.equal(itemsEvents, 0);

      done();
    });
  });

  after(function() {
    Date = lastDate;
  });
});


describe('Same title but different pubdate', function() {
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

  nock(host)
    .get(path)
    .replyWithFile(200, __dirname + '/rss2old.xml')

  it('Read all items in feed', function(done) {
    reader.read(function(err, items) {
      if (err) throw err;
      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemCount, 4);
      assert.equal(itemsEvents, 1);

      itemCount = 0;
      itemsEvents = 0;

      done();
    });
  });


  describe('Read feed again', function() {
    nock(host)
      .get(path)
      .replyWithFile(200, __dirname + '/rss2old.xml')

    it('Should not return any new items', function(done) {
      reader.read(function(err, items) {
        if (err) throw err;
        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemCount, 0);
        assert.equal(itemsEvents, 0);

        itemCount = 0;
        itemsEvents = 0;

        done();
      });
    });


    describe('Read the new updated feed', function() {
      nock(host)
        .get(path)
        .replyWithFile(200, __dirname + '/rss2new.xml')

      it('1 new item with different pubdate', function(done) {
        reader.read(function(err, items) {
          if (err) throw err;
          assert.ok(!err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 1);

          assert.equal(itemCount, 1);
          assert.equal(itemsEvents, 1);

          done();
        });
      });

    });
  });
});
