# FeedSub

FeedSub subscribes to a remote RSS/Atom/JSON feed and notifies you of any new items it reads.

It works by checking the feed every once in a while, comparing the date of the document via a conditional GET if supported. Otherwise it looks for a date tag in the feed. If it's the same as the last date, it stops downloading it and parsing the xml/json. If it's an updated document, then it looks through it top to bottom taking note of all the new items. Once it finds something it has already read, it stops downloading and parsing the document.

![Depfu](https://img.shields.io/depfu/fent/node-feedsub)
[![codecov](https://codecov.io/gh/fent/node-feedsub/branch/master/graph/badge.svg)](https://codecov.io/gh/fent/node-feedsub)

# Usage

```javascript
const FeedSub = require('feedsub');

let reader = new FeedSub('http://rss.cnn.com/rss/cnn_latest.rss', {
  interval: 10 // Check feed every 10 minutes.
});

reader.on('item', (item) => {
  console.log('Got item!');
  console.dir(item);
});

reader.start();
```

# API
### new FeedSub(feed, [options])
Creates a new instance of FeedSub. `options` defaults to.

```javascript
{
  // Number of minutes to wait between checking the feed for new items.
  interval: 10,

  // Some feeds contain a `ttl` tag that specify the
  // number of minutes to cache the feed.
  // Setting this to true will ignore that.
  forceInterval: false,

  // If true, calls `reader.start()` when initialized.
  autoStart: false, 

  // Emits items on the very first request.
  // After which, it should consider those items read.
  emitOnStart: false,

  // Keeps track of last date of the feed.
  lastDate: null,

  // Maximum size of `history` array.
  maxHistory: 10,

  // Some feeds have a `skipHours` tag with a list of
  // hours in which the feed should not be read.
  // if this is set to true and the feed has that tag, it obeys that rule
  skipHours: false,

  // If you'd like to specify exactly what hours to skip.
  hoursToSkip: [],

  // Same as `skipHours`, but with days.
  skipDays: false,

  // Specify exactly what days to skip, ex: ['Saturday', 'Sunday'].
  daysToSkip: [],

  // Options object passed to [miniget](https://github.com/fent/node-miniget).
  requestOpts: {}
}
```

### FeedSub#read([callback(err, items)])
Reads the feed. Calls `callback` with possible error or new items discovered if provided. Causes `reader` to emit new item events.

### FeedSub#start(readOnStart)
Starts checking the feed for any new items every `options.interval` minutes. If `readOnStart` is true, it checks right away.

### FeedSub#options
Options that were passed to the constructor along with any defaults are kept here.

### FeedSub#stop()
Stops the reader from automatically reading the feed.

### Event: item
* `Object` - Item.

Emitted whenever there is a new item.

### Event: items
* `Array.<Object>` - List of items.

Emits all new items from one request in one array.

### Event: error
* `Error`

Emitted when there is an error downloading or parsing the feed. Not emitted if `callback` is given for `read` or `readInterval`.


# Install

    npm install feedsub


# Tests

Tests are written with [mocha](https://mochajs.org)

```bash
npm test
```
