Install
------------

    npm install feedsub


Usage
------------------

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

FeedSub is simple. It reads a remote feed, keeps reading it every once in a while, and lets you know whenever it finds something new. It checks the date of the document, if it's the same as the last date, it stops downloading it and parsing the xml. If it's an updated document, then it looks through it top to bottom recording all the new items. Once it finds something it has read, it stops downloading and parsing.


API
---
###new FeedSub(feed, [options])
Creates a new instance of FeedSub. `options` defaults to.

```javascript
{
  interval: 10, // number of minutes to wait between checking the feed
                // for new items
  forceInterval: true, // some feeds contain a `ttl` tag that specifies the
                       // number of minutes to cache the feed
                       // this will ignore that
  autoStart: false, // if true, calls `reader.start()` on instanstiation
  emitOnStart: true, // emits items on the very first request
                     // after which, it should consider those items read
  lastDate: null, // keeps track of last date of the feed
  history: [], // keeps track of last items from the feed
  maxHistory: 50, // maximum size of `history` array
  skipHours: false, // some feeds have a `skipHours` tag with a list ofs
                    // hours in which the feed should not be read.
                    // if this is set to true and the feed has that tag,
                    // it follows that rule.
  skipDays: false // same as above but with days
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
Emits all new items from one request in one array, and the date from the feed at that specific request. Useful if you want to keep track of `options.lastDate` and `options.history`.

###Event: 'error'
Emitted when there is an error downloading or parsing the feed. Not emitted if `callback` is given for `read` or `readInterval`.
