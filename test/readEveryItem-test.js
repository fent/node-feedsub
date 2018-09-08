const FeedSub = require('..');
const nock    = require('nock');
const sinon   = require('sinon');
const assert  = require('assert');
const path    = require('path');


const file1 = path.join(__dirname, 'assets', 'googlefeed.xml');
const file2 = path.join(__dirname, 'assets', 'googlefeedupdated.xml');


describe('Read all published/updated items with readEveryItem', () => {
  it('Should return all updated items', (done) => {
    const host = 'https://www.blogger.com';
    const path = '/feeds/10861780/posts/default';
    const reader = new FeedSub(host + path, {
      emitOnStart: true, readEveryItem: true
    });
    const itemSpy = sinon.spy();
    const itemsSpy = sinon.spy();

    reader.on('item', itemSpy);
    reader.on('items', itemsSpy);

    let scope1 = nock(host)
      .get(path)
      .replyWithFile(200, file1);

    reader.read((err, items) => {
      assert.ifError(err);

      assert.ok(Array.isArray(items));
      assert.equal(items.length, 6);
      assert.equal(itemSpy.callCount, 6);
      assert.equal(itemsSpy.callCount, 1);

      itemSpy.resetHistory();
      itemsSpy.resetHistory();
      scope1.done();

      let scope2 = nock(host)
        .get(path)
        .replyWithFile(200, file2);

      reader.read((err, items) => {
        assert.ifError(err);
        assert.ok(Array.isArray(items));
        assert.equal(items.length, 3);
        assert.equal(itemSpy.callCount, 3);
        assert.equal(itemsSpy.callCount, 1);
        scope2.done();
        done();
      });
    });
  });
});
