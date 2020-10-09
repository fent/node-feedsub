const EventEmitter = require('events').EventEmitter;
const FeedMe       = require('feedme');
const NewsEmitter  = require('newsemitter');
const miniget      = require('miniget');
const zlib         = require('zlib');


// Used for the skipdays tag.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday'];


module.exports = class FeedReader extends EventEmitter {
  /**
   * @constructor
   * @param {string} feed
   * @param {!Object} options
   */
  constructor(feed, options) {
    super();
    this.feed = feed;
    this.options = Object.assign({
      interval      : 10,
      forceInterval : false,
      autoStart     : false,
      emitOnStart   : false,
      lastDate      : null,
      history       : [],
      maxHistory    : 10,
      skipHours     : false,
      skipDays      : false,
    }, options);

    // Create news emitter.
    this.news = new NewsEmitter({
      maxHistory: this.options.maxHistory,
      manageHistory: true,
      identifier: (item) => {
        item = item[0];
        return [
          item.title,
          item.link,
          item.pubdate,
          item.published,
          item.updated
        ].join(',');
      }
    });

    this.news.addHistory('item', this.options.history);
    this.first = this.news.history.get('item').size === 0;
    this.getOpts = Object.assign({
      headers: {},
      acceptEncoding: {
        gzip: () => zlib.createGunzip(),
        deflate: () => zlib.createInflate(),
      },
    }, this.options.requestOpts);
    if (this.options.autoStart) {
      this.start(true);
    }
  }


  /**
   * Start calling the read function on interval.
   *
   * @param {boolean} readOnStart
   */
  start(readOnStart) {
    this.stop();
    let ms = this.options.interval * 60000;
    this._intervalid = setInterval(this.read.bind(this), ms);
    if (readOnStart) {
      this.read();
    }
  }


  /**
   * Stop interval if any
   */
  stop() {
    clearInterval(this._intervalid);
  }


  /**
   * Reads feed and determines if there are any new items
   * emits new items through event `item`
   * if there are new items, emits `items` event at end with all items
   *
   * if callback is given, calls callback with all new items
   * even when there are 0.
   *
   * @param {!Function(!Error, Array.<Object>)} callback
   */
  read(callback) {
    let ended = false;
    let aborted = false;
    let req;
    let items = [];
    let newItems = [];
    let sortOrder = 0;

    const error = (abort, err) => {
      ended = true;
      this.first = false;
      if (!aborted) {
        if (typeof callback === 'function') {
          callback(err);
        } else {
          this.emit('error', err);
        }
      }
      if (abort && !aborted) {
        aborted = true;
        req.abort();
      }
    };

    const success = (abort) => {
      if (ended) { return; }
      ended = true;
      if (sortOrder <= 0) {
        newItems.reverse();
      }
      this.news.addHistory('item', newItems.map((item) => [item]));
      if (this.first && !this.options.emitOnStart) {
        newItems = [];
      }
      newItems.forEach(this.emit.bind(this, 'item'));
      this.emit('items', newItems);
      if (abort && !aborted) {
        aborted = true;
        req.abort();
      }
      if (typeof callback === 'function') {
        callback(null, newItems);
      }
    };

    // If skipHours or skipDays are enabled and feed provides hours/days
    // to skip and it's currently one of those hours/days, abort.
    const now = new Date();
    const shouldSkip = () => {
      return (
        (!this.first || !this.options.emitOnStart) &&
        (this.options.hoursToSkip || this.options.daysToSkip)
      ) && (
        (this.options.hoursToSkip &&
         this.options.hoursToSkip.indexOf(now.getHours()) !== -1) ||
        (this.options.daysToSkip &&
         this.options.daysToSkip.some((day) => {
           return day.toLowerCase() === DAYS[now.getDay()];
         })
        )
      );
    };

    if (shouldSkip()) {
      return success();
    }

    req = miniget(this.feed, this.getOpts);
    req.on('response', (res) => {
      // Check if not modified code is sent back
      // in this case, the body will be empty.
      if (res.statusCode === 304) {
        return success();
      }

      // Check headers for conditional get.
      if (res.headers['last-modified']) {
        this.getOpts.headers['If-Modified-Since'] = res.headers['last-modified'];
      }
      if (res.headers.etag) {
        this.getOpts.headers['If-None-Match'] = res.headers.etag;
      }

      // Save date.
      let date;
      let getdate = text => date = text;

      // Create feed parser.
      const parser = new FeedMe();
      parser.on('error', error.bind(null, true));

      // Try to get date from one of the fields.
      parser.once('pubdate', getdate);
      parser.once('lastbuilddate', getdate);
      parser.once('updated', getdate);

      // Change interval time if ttl available.
      if (!this.options.forceInterval) {
        parser.once('ttl', (minutes) => {
          minutes = parseInt(minutes, 10);

          // Only update if ttl is longer than requested interval.
          if (minutes > this.options.interval) {
            this.options.interval = minutes;
            if (this.options.autoStart) {
              this.start(false);
            }
          }
        });
      }

      // Listen for skipHours if enabled.
      if (this.options.skipHours && !this.options.hoursToSkip) {
        parser.once('skiphours', (data) => {
          this.options.hoursToSkip =
            [].concat(data.hour).map(h => parseInt(h, 10));
        });
      }

      // Listen for skipDays if enabled.
      if (this.options.skipDays !== false && !this.options.daysToSkip) {
        parser.once('skipdays', (data) => {
          this.options.daysToSkip = [].concat(data.day);
        });
      }


      // Compare date when first item is encountered.
      const firstitem = (item) => {
        // If date is the same as last, abort.
        if (date && this.options.lastDate === date) {
          return success();
        }

        if (shouldSkip()) {
          return success();
        }

        // Continue if dates differ.
        if (date) {
          this.options.lastDate = date;
        }
        parser.on('item', getItem);
        getItem(item);
      };

      parser.once('item', firstitem);

      const getItemDate = (item) => new Date(item.pubdate || item.published || 0);
      const getItem = (item) => {
        if (sortOrder === 0) {
          items.push(item);
          sortOrder = getItemDate(item) - getItemDate(items[0]);
          if (sortOrder < 0) {
            items.forEach(getOlderItem);
          } else if (sortOrder > 0) {
            items.forEach(getNewerItem);
          }
        } else if (sortOrder < 0) {
          getOlderItem(item);

        } else {
          getNewerItem(item);
        }
      };

      const getOlderItem = (item) => {
        if (this.first) {
          newItems.push(item);
        } else if (!ended) {
          let emitted = this.news.emit('item', item);
          if (emitted) {
            newItems.push(item);
          } else {
            // Check if this item has already been read in previous requests
            // if it has, then stop parsing the rest of the document.
            parser.removeListener('item', getItem);
            success(true);
          }
        }
      };

      let foundPrevItem = false;
      const getNewerItem = (item) => {
        if (this.first) {
          newItems.push(item);
        } else if (!foundPrevItem && !this.news.emit('item', item)) {
          foundPrevItem = true;
        } else if (foundPrevItem && this.news.emit('item', item)) {
          newItems.push(item);
        }
      };

      req.pipe(parser);

      req.on('end', () => {
        if (ended) { return; }
        // Process items in descending order if no order found at end.
        if (sortOrder === 0 && newItems.length === 0) {
          items.forEach(getOlderItem);
        }
        success();
        this.first = false;
      });
    });

    req.on('error', error.bind(null, false));
  }
};
