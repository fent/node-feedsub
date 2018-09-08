const FeedSub = require('..');
const nock    = require('nock');
const assert  = require('assert');
const path    = require('path');
const fs      = require('fs');
const zlib    = require('zlib');


const feed = path.join(__dirname, 'assets', 'rss2old.xml');


describe('Compressed feed with gzip', () => {
  it('Able to parse and read feed', () => {
    const host = 'http://feedburner.info';
    const path = '/rss';
    const reader = new FeedSub(host + path, { emitOnStart: true });

    const scope = nock(host, {
      reqheaders: { 'Accept-Encoding': /\bgzip\b/ }
    })
      .get(path)
      .reply(200, fs.createReadStream(feed).pipe(new zlib.createGzip()), {
        'Content-Encoding': 'gzip'
      });

    reader.read((err, items) => {
      assert.ifError(err);
      assert.ok(Array.isArray(items));
      assert.equal(items.length, 4);
      scope.done();
    });
  });
});
