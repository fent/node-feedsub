const EventEmitter = require('events').EventEmitter;
const util         = require('util');
const FeedMe       = require('feedme');
const NewsEmitter  = require('newsemitter');
const http         = require('http');
const https        = require('https');
const url          = require('url');
const zlib         = require('zlib');


// These will be used for the skipdays tag.
var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday'];


/**
 * @constructor
 * @param {String} feed
 * @param {!Object} options
 */
var FeedReader = module.exports = function(feed, options) {
  this.options = {
    interval: 10,
    forceInterval: false,
    autoStart: false,
    emitOnStart: false,
    altDateField: null,
    lastDate: null,
    history: [],
    maxHistory: 10,
    skipHours: false,
    skipDays: false,
    readEveryItem: false
  };
  options = options || {};
  for (var opt in options) {
    this.options[opt] = options[opt];
  }

  // Create news emitter.
  this.news = new NewsEmitter({
    maxHistory: this.options.maxHistory,
    identifier: function(item) {
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


  var self = this;
  this.newitems = [];
  this.first = this.news.history.item.length === 0;

  // Keep track of and emit new items.
  this.news.on('item', function(item) {
    if (!self.first || self.options.emitOnStart) {
      self.newitems.unshift(item);
    }
  });

  this.getOpts = url.parse(feed);
  this.getOpts.headers = {};
  for (var opt2 in this.options.requestOpts) {
    this.getOpts[opt2] = this.options.requestOpts[opt2];
  }

  if (this.options.autoStart) {
    this.start();
  }
};

// Inherit from EventEmitter.
util.inherits(FeedReader, EventEmitter);


/**
 * Start calling the read function on interval.
 *
 * @param {!Boolean} begin
 */
FeedReader.prototype.start = function(begin) {
  if (begin == null) begin = true;
  this.intervalid = this.readInterval(this.options.interval, null, begin);
};


/**
 * Stop interval if any
 */
FeedReader.prototype.stop = function() {
  if (this.intervalid) {
    clearInterval(this.intervalid);
    delete this.intervalid;
  }
};


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
FeedReader.prototype.read = function(callback) {
  var self = this;
  var ended = false;

  function error(err) {
    ended = true;
    self.newitems = [];
    self.first = false;
    req.abort();
    if (typeof callback === 'function') {
      callback(err);
    } else {
      self.emit('error', err);
    }
  }

  function success(results, abort) {
    ended = true;
    self.newitems = [];
    if (abort) {
      req.abort();
    }

    results.forEach(function(item) {
      self.emit('item', item);
    });
    self.emit('items', results);
    if (typeof callback === 'function') {
      callback(null, results);
    }
  }


  var httpLib = {
    'http:': http,
    'https:': https,
  }[this.getOpts.protocol];
  var req = httpLib.get(this.getOpts, function(res) {
    // Check the response is successful.
    if (res.statusCode !== 200) {

      // Check if not modified code is sent back
      // in this case, the body will be empty.
      if (res.statusCode === 304) {
        return success([]);
      }

      return error(new Error('Status Code: ' + res.statusCode));
    }


    // Check headers for conditional get.
    if (res.headers['last-modified']) {
      self.getOpts.headers['If-Modified-Since'] = res.headers['last-modified'];
    }
    if (res.headers.etag) {
      self.getOpts.headers['If-None-Match'] = res.headers.etag;
    }

    // Save date.
    var date;
    var getdate = function(text) {
      return date = text;
    };

    // Create feed parser.
    var parser = new FeedMe();
    parser.on('error', error);

    // Try to get date from one of the fields.
    parser.once('pubdate', getdate);
    parser.once('lastbuilddate', getdate);
    parser.once('updated', getdate);
    if (self.options.altDateField) {
      parser.once(self.options.altDateField, getdate);
    }

    // Change interval time if ttl available.
    if (!self.options.forceInterval) {
      parser.once('ttl', function(minutes) {
        minutes = parseInt(minutes, 10);

        // Only update if ttl is longer than requested interval.
        if (minutes > self.options.interval) {
          self.options.interval = minutes;
          if (self.intervalid) {
            self.start(false);
          }
        }
      });
    }


    // Listen for skipHours if enabled.
    if (self.options.skipHours) {
      parser.once('skiphours', function(data) {
        if (self.options.hoursToSkip) { return; }
        var hours = data.hour;

        self.options.hoursToSkip = Array.isArray(hours) ?
          data.hour.map(function(h) {
            return parseInt(h, 10);
          }) : [parseInt(hours, 10)];
      });
    }

    // Listen for skipDays if enabled.
    if (self.options.skipDays !== false) {
      parser.once('skipdays', function(data) {
        if (self.options.daysToSkip) { return; }
        var days = data.day;
        self.options.daysToSkip = Array.isArray(days) ? days : [days];
      });
    }


    // Compare date when first item is encountered.
    var firstitem = function(item) {

      // If date is the same as last, abort.
      if (date && self.options.lastDate === date) {
        return success([], true);
      }

      // If skipHours or skipDays are enabled and feed provides hours/days
      // to skip and it's one of those hours/days, abort.
      if (self.options.hoursToSkip || self.options.daysToSkip) {
        var now = new Date();
        if ((self.options.hoursToSkip &&
             self.options.hoursToSkip.indexOf(now.getHours()) !== -1) ||
            (self.options.daysToSkip &&
              self.options.daysToSkip.some(function(day) {
                return day.toLowerCase() === DAYS[now.getDay()];
              })
            )) {
          return success([], true);
        }
      }

      // Continue if dates differ.
      if (date) {
        self.options.lastDate = date;
      }
      parser.on('item', getitems);
      getitems(item);
    };

    parser.once('item', firstitem);

    var getitems = function(item) {
      if (self.first && self.options.emitOnStart) {
        self.newitems.unshift(item);

      } else if (!self.news.emit('item', item) && !self.options.readEveryItem) {
        // Check if this item has already been read in previous requests
        // if it has, then stop parsing the rest of the document.
        parser.removeListener('item', getitems);
        success(self.newitems);
      }
    };

    var output;

    // Pipe data from response to gunzipper/inflater.
    switch(res.headers['content-encoding']) {
      case 'gzip':
        output = zlib.createGunzip();
        res.pipe(output);
        break;
      case 'deflate':
        output = zlib.createInflate();
        res.pipe(output);
        break;
      default:
        output = res;
    }

    // Pipe data from gunzipper/inflater to parser.
    output.on('data', function(chunk) {
      parser.write(chunk);
    });

    output.on('end', function() {
      if (parser.close) { parser.close(); }
      if (!ended) {
        if (self.first && self.options.emitOnStart) {
          self.news.addHistory('item', self.newitems.map(function(item) {
            return { 0: 'item', 1: item };
          }));
        }
        success(self.newitems);
        self.first = false;
      }
    });
  });

  req.on('error', error);
};


/**
 * Starts calling the read fuction in an interval.
 * Passes callback to read
 * if begin is true, call read immediately.
 *
 * @param {!Function(!Error, Array.<Object>)} callback
 * @param {Number} interval
 * @param {Boolean} begin
 */
FeedReader.prototype.readInterval = function(callback, interval, begin) {
  var self = this;
  this.stop();

  // Allow callback argument to be optional.
  if (typeof callback === 'number') { interval = callback; }
  interval = parseInt(interval, 10);

  if (interval > 0) {
    if (begin) { this.read(callback); }

    return setInterval(function() {
      return self.read(callback);
    }, interval * 60000);
  }
};
