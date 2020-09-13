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
      emitFirstOnStart  : false,
      lastDate      : null,
      history       : [],
      maxHistory    : 10,
      skipHours     : false,
      skipDays      : false,
      readEveryItem : false
    }, options);

    // Create news emitter.
    this.news = new NewsEmitter({
      maxHistory: this.options.maxHistory,
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

    /* preload history if available */
    this.news.addHistory('item', this.options.history);

    this.newitems = [];
    this.first = this.news.history.get('item').size === 0;
    this.initialEmitCount = 0;

    // Keep track of and emit new items.
    this.news.on('item', (item) => {
      if (!this.first || this.options.emitOnStart) {
        this.newitems.unshift(item);
      }

      if (this.options.emitFirstOnStart) {

        if (this.initialEmitCount>0) {
          return;
        }

        this.initialEmitCount = 1;
        this.newitems.unshift(item);
      }

    });

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

    const error = (abort, err) => {
      ended = true;
      this.newitems = [];
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

    const success = (results, abort) => {
      ended = true;
      this.newitems = [];
      if (abort && !aborted) {
        aborted = true;
        if (req) {
          req.abort();
        }
      }

      results.forEach((item) => {
        this.emit('item', item);
      });
      this.emit('items', results);
      if (typeof callback === 'function') {
        callback(null, results);
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
      return success([], true);
    }

    req = miniget(this.feed, this.getOpts);
    req.on('response', (res) => {
      // Check if not modified code is sent back
      // in this case, the body will be empty.
      if (res.statusCode === 304) {
        return success([]);
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
          return success([], true);
        }

        if (shouldSkip()) {
          return success([], true);
        }

        // Continue if dates differ.
        if (date) {
          this.options.lastDate = date;
        }
        parser.on('item', getitems);
        getitems(item);
      };

      parser.once('item', firstitem);

      const getitems = (item) => {
        if (this.first && this.options.emitOnStart) {
          this.newitems.unshift(item);

        } else if (!this.news.emit('item', item) &&
            !this.options.readEveryItem) {
          // Check if this item has already been read in previous requests
          // if it has, then stop parsing the rest of the document.
          parser.removeListener('item', getitems);
          success(this.newitems);
        }
      };

      req.pipe(parser);

      req.on('end', () => {
        if (!ended) {
          if (this.first && this.options.emitOnStart) {
            this.news.addHistory('item', this.newitems.map((item) => {
              return [item];
            }));
          }
          success(this.newitems);
          this.first = false;
        }
      });
    });

    req.on('error', error.bind(null, false));
  }
};
