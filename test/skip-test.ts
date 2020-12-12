import FeedSub from '..';
import nock from 'nock';
import sinon from 'sinon';
import assert from 'assert';
import { join } from 'path';


describe('Use skipHours', () => {
  const feed = join(__dirname, 'assets', 'skiphours.rss');
  afterEach(sinon.restore);
  describe('With hours that match time now', () => {
    describe('With `emitOnStart`', () => {
      it('Should return some items', (done) => {
        sinon.stub(Date.prototype, 'getHours').returns(4);
        const host = 'http://www.google.com';
        const path = '/reader/public/atom/';
        const reader = new FeedSub(host + path, {
          emitOnStart: true, skipHours: true
        });

        const scope = nock(host)
          .get(path)
          .replyWithFile(200, feed);

        reader.read((err, items) => {
          assert.ifError(err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 20);
          scope.done();

          process.nextTick(() => {
            reader.read((err, items) => {
              assert.ifError(err);
              assert.ok(Array.isArray(items));
              assert.equal(items.length, 0);
              done();
            });
          });
        });
      });
    });

    describe('Without `emitOnStart`', () => {
      it('Should return no items', (done) => {
        sinon.stub(Date.prototype, 'getHours').returns(4);
        const host = 'http://www.google.com';
        const path = '/reader/public/atom/';
        const reader = new FeedSub(host + path, {
          emitOnStart: false, skipHours: true
        });

        const scope = nock(host)
          .get(path)
          .replyWithFile(200, feed);

        reader.read((err, items) => {
          assert.ifError(err);
          assert.ok(Array.isArray(items));
          assert.equal(items.length, 0);
          scope.done();
          done();
        });
      });
    });
  });

  describe('With hours that don\'t match', () => {
    it('Should return some items', (done) => {
      sinon.stub(Date.prototype, 'getHours').returns(7);
      const host = 'http://www.google.com';
      const path = '/reader/public/atom/';
      const reader = new FeedSub(host + path, {
        emitOnStart: true, skipHours: true
      });

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, feed);

      reader.read((err, items) => {
        assert.ifError(err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 20);
        scope.done();
        done();
      });
    });
  });
});

describe('Use skipDays', () => {
  const feed = join(__dirname, 'assets', 'skipdays.xml');

  it('Should return no items', (done) => {
    sinon.stub(Date.prototype, 'getHours').returns(6);
    const host = 'http://blog.nodejs.org';
    const path = '/feed/';
    const reader = new FeedSub(host + path, {
      emitOnStart: false, skipDays: true
    });

    const scope = nock(host)
      .get(path)
      .replyWithFile(200, feed);

    reader.read((err, items) => {
      assert.ifError(err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 0);
      scope.done();
      done();
    });
  });
});
