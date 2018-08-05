const EventEmitter = require('events').EventEmitter;
const FeedMe       = require('feedme');
const NewsEmitter  = require('newsemitter');
const miniget      = require('miniget');
const zlib         = require('zlib');


// These will be used for the skipdays tag.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday'];


module.exports = class FeedReader extends EventEmitter {
  /**
   * @constructor
   * @param {String} feed
   * @param {!Object} options
   */
  constructor(feed, options) {
    options = options || {};
    super();
    this.feed = feed;
    this.options = {
      interval      : 10,
      forceInterval : false,
      autoStart     : false,
      emitOnStart   : false,
      altDateField  : null,
      lastDate      : null,
      history       : [],
      maxHistory    : 10,
      skipHours     : false,
      skipDays      : false,
      readEveryItem : false
    };
    Object.assign(this.options, options);

    // Create news emitter.
    this.news = new NewsEmitter({
      maxHistory: this.options.maxHistory,
      identifier: (item) => {
        item = item[1];
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

    this.newitems = [];
    this.first = this.news.history.item.length === 0;

    // Keep track of and emit new items.
    this.news.on('item', (item) => {
      if (!this.first || this.options.emitOnStart) {
        this.newitems.unshift(item);
      }
    });

    this.getOpts = Object.assign({ headers: {} }, this.options.requestOpts);
    if (this.options.autoStart) {
      this.start();
    }
  }


  /**
   * Start calling the read function on interval.
   *
   * @param {!Boolean} begin
   */
  start(begin) {
    if (begin == null) begin = true;
    this.intervalid = this.readInterval(this.options.interval, null, begin);
  }


  /**
   * Stop interval if any
   */
  stop() {
    if (this.intervalid) {
      clearInterval(this.intervalid);
      delete this.intervalid;
    }
  }


  /**
   *
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

    const error = (abort, err) => {
      ended = true;
      this.newitems = [];
      this.first = false;
      if (abort && !aborted) {
        aborted = true;
        req.abort();
      }
      if (!aborted) {
        if (typeof callback === 'function') {
          callback(err);
        } else {
          this.emit('error', err);
        }
      }
    };

    const success = (results, abort) => {
      ended = true;
      this.newitems = [];
      if (abort && !aborted) {
        aborted = true;
        req.abort();
      }

      results.forEach((item) => {
        this.emit('item', item);
      });
      this.emit('items', results);
      if (typeof callback === 'function') {
        callback(null, results);
      }
    };

    const req = miniget(this.feed, this.getOpts);
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
      if (this.options.altDateField) {
        parser.once(this.options.altDateField, getdate);
      }

      // Change interval time if ttl available.
      if (!this.options.forceInterval) {
        parser.once('ttl', (minutes) => {
          minutes = parseInt(minutes, 10);

          // Only update if ttl is longer than requested interval.
          if (minutes > this.options.interval) {
            this.options.interval = minutes;
            if (this.intervalid) {
              this.start(false);
            }
          }
        });
      }

      // Listen for skipHours if enabled.
      if (this.options.skipHours) {
        parser.once('skiphours', (data) => {
          if (this.options.hoursToSkip) { return; }
          let hours = data.hour;

          this.options.hoursToSkip = Array.isArray(hours) ?
            data.hour.map(h => parseInt(h, 10)) : [parseInt(hours, 10)];
        });
      }

      // Listen for skipDays if enabled.
      if (this.options.skipDays !== false) {
        parser.once('skipdays', (data) => {
          if (this.options.daysToSkip) { return; }
          let days = data.day;
          this.options.daysToSkip = Array.isArray(days) ? days : [days];
        });
      }


      // Compare date when first item is encountered.
      const firstitem = (item) => {

        // If date is the same as last, abort.
        if (date && this.options.lastDate === date) {
          return success([], true);
        }

        // If skipHours or skipDays are enabled and feed provides hours/days
        // to skip and it's one of those hours/days, abort.
        if (this.options.hoursToSkip || this.options.daysToSkip) {
          let now = new Date();
          if ((this.options.hoursToSkip &&
               this.options.hoursToSkip.indexOf(now.getHours()) !== -1) ||
              (this.options.daysToSkip &&
                this.options.daysToSkip.some((day) => {
                  return day.toLowerCase() === DAYS[now.getDay()];
                })
              )) {
            return success([], true);
          }
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

      let output;

      // Pipe data from response to gunzipper/inflater.
      switch(res.headers['content-encoding']) {
        case 'gzip':
          output = zlib.createGunzip();
          req.pipe(output);
          break;
        case 'deflate':
          output = zlib.createInflate();
          req.pipe(output);
          break;
        default:
          output = req;
      }

      // Pipe data from gunzipper/inflater to parser.
      output.pipe(parser);

      output.on('end', () => {
        if (parser.close) { parser.close(); }
        if (!ended) {
          if (this.first && this.options.emitOnStart) {
            this.news.addHistory('item', this.newitems.map((item) => {
              return { 0: 'item', 1: item };
            }));
          }
          success(this.newitems);
          this.first = false;
        }
      });
    });

    req.on('error', error.bind(null, false));
  }


  /**
   * Starts calling the read fuction in an interval.
   * Passes callback to read
   * if begin is true, call read immediately.
   *
   * @param {!Function(!Error, Array.<Object>)} callback
   * @param {Number} interval
   * @param {Boolean} begin
   */
  readInterval(callback, interval, begin) {
    this.stop();

    // Allow callback argument to be optional.
    if (typeof callback === 'number') { interval = callback; }
    interval = parseInt(interval, 10);

    if (interval > 0) {
      if (begin) { this.read(callback); }

      return setInterval(() => this.read(callback), interval * 60000);
    }
  }
};
