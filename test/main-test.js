const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const assert  = require('assert');
const path    = require('path');


const feedold = path.join(__dirname, 'assets', 'feedold.xml');
const feednew = path.join(__dirname, 'assets', 'feednew.xml');
const rss2old = path.join(__dirname, 'assets', 'rss2old.xml');
const rss2new = path.join(__dirname, 'assets', 'rss2new.xml');


describe('Read the old RSS feed first', () => {
  var host = 'http://feedsite.info';
  var path = '/rss/feed.xml';
  var reader = new FeedSub(host + path, { emitOnStart: true });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, feedold);

  it('Reads all items in feed', (done) => {
    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997,
        'Callback gets correct number of items');
      assert.equal(itemSpy.callCount, 2997,
        'Correct number of item events emitted');
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.reset();
      itemsSpy.reset();

      done();
    });
  });


  describe('Read feed again', () => {
    nock(host)
      .get(path)
      .replyWithFile(200, feedold);

    it('Does not return any new items', (done) => {
      reader.read((err, items) => {
        if (err) return done(err);

        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemSpy.callCount, 0);
        assert.equal(itemsSpy.callCount, 1);

        itemSpy.reset();
        itemsSpy.reset();

        done();
      });
    });

    // Read the new feed this time.
    describe('Read updated feed', () => {
      nock(host)
        .get(path)
        .replyWithFile(200, feednew);


      it('Returns some new items', (done) => {
        reader.read((err, items) => {
          if (err) return done(err);

          assert.ok(Array.isArray(items));
          assert.equal(items.length, 3, '3 new items');

          assert.equal(itemSpy.callCount, 3);
          assert.equal(itemsSpy.callCount, 1);

          done();
        });
      });
    });

  });
});


describe('Same title but different pubdate', () => {
  var host = 'http://feedburner.info';
  var path = '/rss';
  var reader = new FeedSub(host + path, { emitOnStart: true });
  var itemSpy = sinon.spy();
  var itemsSpy = sinon.spy();

  reader.on('item', itemSpy);
  reader.on('items', itemsSpy);

  nock(host)
    .get(path)
    .replyWithFile(200, rss2old);

  it('Read all items in feed', (done) => {
    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemSpy.callCount, 4);
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.reset();
      itemsSpy.reset();

      done();
    });
  });


  describe('Read feed again', () => {
    nock(host)
      .get(path)
      .replyWithFile(200, rss2old);

    it('Should not return any new items', (done) => {
      reader.read((err, items) => {
        if (err) return done(err);

        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);

        assert.equal(itemSpy.callCount, 0);
        assert.equal(itemsSpy.callCount, 1);

        itemSpy.reset();
        itemsSpy.reset();

        done();
      });
    });


    describe('Read the new updated feed', () => {
      nock(host)
        .get(path)
        .replyWithFile(200, rss2new);

      it('1 new item with different pubdate', (done) => {
        reader.read((err, items) => {
          if (err) return done(err);

          assert.ok(!err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 1);

          assert.equal(itemSpy.callCount, 1);
          assert.equal(itemsSpy.callCount, 1);

          done();
        });
      });

    });
  });
});
