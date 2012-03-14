# FeedSub [![Build Status](https://secure.travis-ci.org/fent/node-feedsub.png)](http://travis-ci.org/fent/node-feedsub)

FeedSub subscribes to a remote RSS/Atom/JSON feed and notifies you of any new items it reads.

It works by checking the feed every once in a while, comparing the date of the document via a conditional GET if supported. Otherwise it looks for a date tag in the feed. If it's the same as the last date, it stops downloading it and parsing the xml/json. If it's an updated document, then it looks through it top to bottom taking note of all the new items. Once it finds something it has already read, it stops downloading and parsing the document.


# Usage

```javascript
var FeedSub = require('feedsub');

reader = new FeedSub('http://rss.cnn.com/rss/cnn_latest.rss', {
  interval: 10 // check feed every 10 minutes
});

reader.on('item', function(item) {
  console.log('Got item!');
  console.dir(item);
});

reader.start();
```

#API
###new FeedSub(feed, [options])
Creates a new instance of FeedSub. `options` defaults to.

```javascript
{
  // number of minutes to wait between checking the feed for new items
  interval: 10,

  // some feeds contain a `ttl` tag that specifies the
  // number of minutes to cache the feed
  // setting this to true will ignore that
  forceInterval: false,

  // if true, calls `reader.start()` on instanstiation
  autoStart: false, 

  // emits items on the very first request
  // after which, it should consider those items read
  emitOnStart: false,

  // keeps track of last date of the feed
  lastDate: null,

  // maximum size of `history` array
  maxHistory: 10,

  // some feeds have a `skipHours` tag with a list of
  // hours in which the feed should not be read.
  // if this is set to true and the feed has that tag, it obeys that rule
  skipHours: false,

  // same as `skipHours`, but with days
  skipDays: false,

  // options object passed to the http(s).get function
  requestOpts: {}
}
```

###reader.read([callback(err, items)])
Reads the feed. Calls `callback` with possible error or new items discovered if provided. Causes `reader` to emit new item events.

###reader.readInterval([callback(err, items)], interval)
Calls `reader.read` every `interval` milliseconds. If `callback` is an integer, it is considered the `interval`.

###reader.start()
Calls `reader.readInterval` with the `options.interval` from the constructor.

###reader.options
Options that were passed to the constructor along with any defaults are kept here.

###reader.stop()
Stops the reader from automatically reading the feed.

###Event: 'item'
`function (item) { }`
Emitted whenever there is a new item.

###Event: 'items'
`function (items, date) { }`
Emits all new items from one request in one array, and the date from the feed at that specific request. Useful if you want to keep track of `options.lastDate`.

###Event: 'error'
Emitted when there is an error downloading or parsing the feed. Not emitted if `callback` is given for `read` or `readInterval`.


#Install

    npm install feedsub


#Tests

Tests are written with [mocha](http://visionmedia.github.com/mocha/)

```bash
npm test
```


# License

MIT
