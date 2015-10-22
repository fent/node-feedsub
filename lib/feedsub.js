var EventEmitter = require('events').EventEmitter;
var util         = require('util');
var _            = require('underscore');
var FeedMe       = require('feedme');
var NewsEmitter  = require('newsemitter');
var request      = require('request');


// These will be used for the skipdays tag.
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
            'Thursday', 'Friday', 'Saturday'];


/**
 * @constructor
 * @param {String} feed
 * @param {!Object} options
 */
var FeedReader = module.exports = function(feed, options) {
  this.options = options != null ? options : {};
  _.defaults(this.options, {
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
  });

  // Create news emitter.
  this.news = new NewsEmitter({
    history: this.options.maxHistory,
    manageHistory: true,
    comparator: function(item, hitem) {
      item = item[1];
      return _.isEqual(hitem.title, item.title) &&
        ((!hitem.link && !item.link) || _.isEqual(hitem.link, item.link)) &&
        ((!hitem.pubdate && !hitem.published) ||
         (hitem.pubdate && hitem.pubdate === item.pubdate) ||
         (hitem.published && hitem.published === item.published)) &&
        ((!hitem.updated && !item.updated) ||
         (hitem.updated && hitem.updated === item.updated));
    }
  });

  this.news.history.item = this.options.history;


  var self = this;
  this.newitems = [];
  this.first = this.news.history.item.length === 0;

  // Keep track of and emit new items.
  this.news.on('item', function(item) {
    if (!self.first || self.options.emitOnStart) {
      self.newitems.unshift(item);
    }
  });

  this.getOpts = {
    uri: feed,
    onResponse: true,
    encoding: 'utf8',
    headers: {}
  };
  _.extend(this.getOpts, this.options.requestOpts);

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

    self.news.addHistory('item', results);
    results.forEach(function(item) {
      self.emit('item', item);
    });
    self.emit('items', results);
    if (typeof callback === 'function') {
      callback(null, results);
    }

    self.first = false;
  }


  var req = request(this.getOpts);

  req.on('response', function(res) {
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
        var hours = data.hour;

        self.options.hours = Array.isArray(hours) ?
          data.hour.map(function(h) {
            return parseInt(h, 10);
          }) : [parseInt(hours, 10)];
      });
    }

    // Listen for skipDays if enabled.
    if (self.options.skipDays !== false) {
      parser.once('skipdays', function(data) {
        var days = data.day;
        self.options.days = Array.isArray(days) ? days : [days];
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
      if (self.options.skipHours || self.options.skipDays) {
        var now = new Date();
        if ((self.options.hours &&
             self.options.hours.indexOf(now.getHours()) !== -1) ||
            (self.options.days &&
             self.options.days.indexOf(DAYS[now.getDay()]) !== -1)) {
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
      // Check if this item has already been read in previous requests
      // if it has, then stop parsing the rest of the document.
      if (!self.news.emit('item', item) && !self.options.readEveryItem) {
        parser.removeListener('item', getitems);
        success(self.newitems);
        return;
      }
    };

    // Pipe data from response to parser.
    res.on('data', function(chunk) {
      parser.write(chunk);
    });

    res.on('end', function() {
      if (parser.close) { parser.close(); }
      if (!ended) { success(self.newitems); }
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
