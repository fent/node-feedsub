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
  const host = 'http://feedsite.info';
  const path = '/rss/feed.xml';

  it('Reads all items in feed', (done) => {
    const reader = new FeedSub(host + path, { emitOnStart: true });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    let scope = nock(host)
      .get(path)
      .replyWithFile(200, feedold);

    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 2997,
        'Callback gets correct number of items');
      assert.equal(itemSpy.callCount, 2997,
        'Correct number of item events emitted');
      assert.equal(itemsSpy.callCount, 1);

      scope.done();
      done();
    });
  });


  describe('Read feed again', () => {
    it('Does not return any new items', (done) => {
      const reader = new FeedSub(host + path, { emitOnStart: true });
      const itemSpy = sinon.spy();
      const itemsSpy = sinon.spy();

      reader.on('item', itemSpy);
      reader.on('items', itemsSpy);

      let scope1 = nock(host)
        .get(path)
        .replyWithFile(200, feedold);
      let scope2 = nock(host)
        .get(path)
        .replyWithFile(200, feedold);

      reader.read((err, items) => {
        if (err) return done(err);

        assert.ok(Array.isArray(items));
        assert.equal(items.length, 2997,
          'Callback gets correct number of items');
        assert.equal(itemSpy.callCount, 2997,
          'Correct number of item events emitted');
        assert.equal(itemsSpy.callCount, 1);

        itemSpy.resetHistory();
        itemsSpy.resetHistory();

        scope1.done();
        reader.read((err, items) => {
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 0);

          assert.equal(itemSpy.callCount, 0);
          assert.equal(itemsSpy.callCount, 1);

          scope2.done();
          done();
        });
      });
    });

    // Read the new feed this time.
    describe('Read updated feed', () => {
      it('Returns some new items', (done) => {
        const reader = new FeedSub(host + path, { emitOnStart: true });
        const itemSpy = sinon.spy();
        const itemsSpy = sinon.spy();

        reader.on('item', itemSpy);
        reader.on('items', itemsSpy);

        let scope1 = nock(host)
          .get(path)
          .replyWithFile(200, feedold);
        let scope2 = nock(host)
          .get(path)
          .replyWithFile(200, feednew);

        reader.read((err, items) => {
          if (err) return done(err);

          assert.ok(Array.isArray(items));
          assert.equal(items.length, 2997),

          itemSpy.resetHistory();
          itemsSpy.resetHistory();

          scope1.done();
          reader.read((err, items) => {
            if (err) return done(err);

            assert.ok(Array.isArray(items));
            assert.equal(items.length, 3, '3 new items');

            assert.equal(itemSpy.callCount, 3);
            assert.equal(itemsSpy.callCount, 1);

            scope2.done();
            done();
          });
        });
      });
    });

  });
});


describe('Same title but different pubdate', () => {
  it('Read all items in feed', (done) => {
    const host = 'http://feedburner.info';
    const path = '/rss';
    const reader = new FeedSub(host + path, { emitOnStart: true });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    let scope1 = nock(host)
      .get(path)
      .replyWithFile(200, rss2old);
    let scope2 = nock(host)
      .get(path)
      .replyWithFile(200, rss2new);


    reader.read((err, items) => {
      if (err) return done(err);

      assert.ok(!err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemSpy.callCount, 4);
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.resetHistory();
      itemsSpy.resetHistory();
      scope1.done();

      reader.read((err, items) => {
        if (err) return done(err);

        assert.ok(!err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 1);

        assert.equal(itemSpy.callCount, 1);
        assert.equal(itemsSpy.callCount, 1);

        scope2.done();
        done();
      });
    });
  });
});
