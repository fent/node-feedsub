import FeedSub from '..';
import nock from 'nock';
import sinon from 'sinon';
import assert from 'assert';
import { join } from 'path';


const rss2old = join(__dirname, 'assets', 'rss2old.xml');


describe('Read feed without `emitOnStart`', () => {
  it('Should return no items', (done) => {
    const host = 'http://feedburner.net';
    const path = '/rss/feedme.xml';
    const reader = new FeedSub(host + path, { emitOnStart: false });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    const scope = nock(host)
      .get(path)
      .replyWithFile(200, rss2old);

    reader.read((err, items) => {
      assert.ifError(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);

      assert.equal(itemSpy.callCount, 0);
      assert.equal(itemsSpy.callCount, 1);

      scope.done();
      done();
    });
  });

  describe('With `autoStart`', () => {
    let clock: sinon.SinonFakeTimers;
    beforeEach(() => clock = sinon.useFakeTimers());
    afterEach(() => clock.restore());
    const host = 'http://feedsite.info';
    const path = '/rss/feed.xml';

    it('Emits `items` event with no items', (done) => {
      const reader = new FeedSub(host + path, {
        emitOnStart: false,
        autoStart: true,
      });
      after(() => reader.stop());

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, rss2old);

      const itemSpy = sinon.spy();
      reader.on('error', done);
      reader.on('item', itemSpy);
      reader.on('items', (items) => {
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 0);
        assert.equal(itemSpy.callCount, 0);
        scope.done();
        done();
      });
    });
  });
});

describe('Read with `emitOnStart`', () => {
  it('Should return some items', (done) => {
    const host = 'http://feedburner.net';
    const path = '/rss/feedme.xml';
    const reader = new FeedSub(host + path, { emitOnStart: true });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    const scope = nock(host)
      .get(path)
      .replyWithFile(200, rss2old);

    reader.read((err, items) => {
      assert.ifError(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);

      assert.equal(itemSpy.callCount, 4);
      assert.equal(itemsSpy.callCount, 1);

      scope.done();
      done();
    });
  });

  describe('With `autoStart`', () => {
    let clock: sinon.SinonFakeTimers;
    beforeEach(() => clock = sinon.useFakeTimers());
    afterEach(() => clock.restore());
    const host = 'http://feedsite.info';
    const path = '/rss/feed.xml';

    it('Reads all items in feed', (done) => {
      const reader = new FeedSub(host + path, {
        emitOnStart: true,
        autoStart: true,
      });
      after(() => reader.stop());

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, rss2old);

      const itemSpy = sinon.spy();
      reader.on('error', done);
      reader.on('item', itemSpy);
      reader.on('items', (items) => {
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 4,
          'Callback gets correct number of items');
        assert.equal(itemSpy.callCount, 4,
          'Correct number of item events emitted');
        scope.done();
        done();
      });
    });
  });
});
