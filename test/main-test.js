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

    const scope = nock(host)
      .get(path)
      .replyWithFile(200, feedold);

    reader.read((err, items) => {
      assert.ifError(err);
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

      const scope1 = nock(host)
        .get(path)
        .replyWithFile(200, feedold);
      const scope2 = nock(host)
        .get(path)
        .replyWithFile(200, feedold);

      reader.read((err, items) => {
        assert.ifError(err);
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

        const scope1 = nock(host)
          .get(path)
          .replyWithFile(200, feedold);
        const scope2 = nock(host)
          .get(path)
          .replyWithFile(200, feednew);

        reader.read((err, items) => {
          assert.ifError(err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 2997),

          itemSpy.resetHistory();
          itemsSpy.resetHistory();

          scope1.done();
          reader.read((err, items) => {
            assert.ifError(err);

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

    const scope1 = nock(host)
      .get(path)
      .replyWithFile(200, rss2old);
    const scope2 = nock(host)
      .get(path)
      .replyWithFile(200, rss2new);


    reader.read((err, items) => {
      assert.ifError(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemSpy.callCount, 4);
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.resetHistory();
      itemsSpy.resetHistory();
      scope1.done();

      reader.read((err, items) => {
        assert.ifError(err);

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

describe('With a bad feed', () => {
  let clock;
  beforeEach(() => clock = sinon.useFakeTimers());
  afterEach(() => clock.restore());
  const feed = path.join(__dirname, 'assets', 'badfeed.xml');

  describe('With `autoStart`', () => {
    it('Aborts request and emits error', (done) => {
      const host = 'http://feedburner.info';
      const path = '/rss';
      const reader = new FeedSub(host + path, {
        emitOnStart: true,
        autoStart: true,
      });
      const itemSpy = sinon.spy();
      const itemsSpy = sinon.spy();

      reader.on('item', itemSpy);
      reader.on('items', itemsSpy);

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, feed);

      reader.on('error', (err) => {
        assert.ok(err);
        assert.ok(/Unexpected end/.test(err.message));
        assert.equal(itemSpy.callCount, 0);
        assert.equal(itemsSpy.callCount, 0);
        scope.done();
        done();
      });
    });
  });

  describe('Without `autoStart`', () => {
    it('Aborts request and emits error', (done) => {
      const host = 'http://feedburner.info';
      const path = '/rss';
      const reader = new FeedSub(host + path, {
        emitOnStart: true,
        autoStart: false,
      });
      const itemSpy = sinon.spy();
      const itemsSpy = sinon.spy();

      reader.on('item', itemSpy);
      reader.on('items', itemsSpy);
      reader.on('error', done);

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, feed);

      reader.read((err) => {
        assert.ok(err);
        assert.ok(/Unexpected end/.test(err.message));
        assert.equal(itemSpy.callCount, 0);
        assert.equal(itemsSpy.callCount, 0);
        scope.done();
        done();
      });
    });
  });
});

describe('With `ttl` field', () => {
  let clock;
  beforeEach(() => clock = sinon.useFakeTimers());
  afterEach(() => clock.restore());
  const shortttlfeed = path.join(__dirname, 'assets', 'shortttl.xml');
  const longttlfeed = path.join(__dirname, 'assets', 'longttl.xml');

  describe('Below `interval`', () => {
    it('Checks feed again after `interval`', (done) => {
      const host = 'http://feedburner.info';
      const path = '/rss';
      const reader = new FeedSub(host + path, { autoStart: true });
      after(() => clock.restore());
      reader.on('error', done);

      const scope = nock(host)
        .get(path)
        .twice()
        .replyWithFile(200, shortttlfeed);

      reader.once('items', () => {
        reader.once('items', () => {
          throw Error('Should not call `items` before `interval`');
        });
        clock.tick(1000 * 60 * 5);
        reader.removeAllListeners('items');
        reader.once('items', () => {
          scope.done();
          done();
        });
        clock.tick(1000 * 60 * 5);
      });
    });
  });

  describe('With `forceInterval`', () => {
    it('Checks feed again after `interval`', (done) => {
      const host = 'http://feedburner.info';
      const path = '/rss';
      const reader = new FeedSub(host + path, {
        autoStart: true,
        forceInterval: true,
      });
      after(() => clock.restore());
      reader.on('error', done);

      const scope = nock(host)
        .get(path)
        .twice()
        .replyWithFile(200, longttlfeed);

      reader.once('items', () => {
        reader.once('items', () => {
          scope.done();
          done();
        });
        clock.tick(1000 * 60 * 10);
      });
    });
  });

  describe('Above `interval`', () => {
    it('Checks feed again after `ttl`', (done) => {
      const host = 'http://feedburner.info';
      const path = '/rss';
      const reader = new FeedSub(host + path, { autoStart: true });
      reader.on('error', done);

      const scope = nock(host)
        .get(path)
        .twice()
        .replyWithFile(200, longttlfeed);

      reader.once('items', () => {
        reader.once('items', () => {
          throw Error('Should not call `items` before `ttl` time');
        });
        clock.tick(1000 * 60 * 10);
        reader.removeAllListeners('items');
        reader.once('items', () => {
          scope.done();
          done();
        });
        clock.tick(1000 * 60 * 5);
      });
    });

    describe('Without `autoStart`', () => {
      it('Does not check feed again', (done) => {
        const host = 'http://feedburner.info';
        const path = '/rss';
        const reader = new FeedSub(host + path, { autoStart: false });
        const itemsSpy = sinon.spy();
        reader.on('error', done);
        reader.on('items', itemsSpy);

        const scope = nock(host)
          .get(path)
          .replyWithFile(200, longttlfeed);

        reader.read((err) => {
          assert.ifError(err);
          assert.equal(itemsSpy.callCount, 1);
          clock.tick(1000 * 60 * 20);
          assert.equal(itemsSpy.callCount, 1);
          scope.done();
          done();
        });
      });
    });
  });
});

describe('With no `date` field', () => {
  const feed1 = path.join(__dirname, 'assets', 'nodate1.xml');
  const feed2 = path.join(__dirname, 'assets', 'nodate2.xml');

  it('Still able to tell items apart', (done) => {
    const host = 'http://mysite.com';
    const path = '/myfeed.xml';
    const reader = new FeedSub(host + path, { emitOnStart: true });

    const scope1 = nock(host)
      .get(path)
      .replyWithFile(200, feed1);
    const scope2 = nock(host)
      .get(path)
      .replyWithFile(200, feed2);

    reader.read((err, items) => {
      assert.ifError(err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 1);
      scope1.done();

      reader.read((err, items) => {
        assert.ifError(err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 1);
        assert.equal(items[0].title, 'Some');
        scope2.done();
        done();
      });
    });
  });
});
