var EventEmitter = require('events').EventEmitter
  , util         = require('util')
  , url          = require('url')
  , http         = require('http')
  , https        = require('https')
  , _            = require('underscore')
  , FeedMe       = require('feedme')


// these will be used for the skipdays tag
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
            'Thursday', 'Friday', 'Saturday'];


//
// Constructor
//
var FeedReader = module.exports = function(feed, options) {
  this.options = options != null ? options : {};
  _.defaults(this.options, {
    interval: 10,
    forceInterval: false,
    autoStart: false,
    emitOnStart: false,
    lastDate: null,
    history: [],
    maxHistory: 50,
    skipHours: false,
    skipDays: false
  });

  var parsed = url.parse(feed);
  switch (parsed.protocol) {
    case 'http:':
      this.r = http;
      break;
    case 'https:':
      this.r = https;
  }

  this.getOpts = {
    host: parsed.host,
    port: parsed.port,
    path: parsed.pathname + (parsed.search || '') + (parsed.hash || ''),
    auth: parsed.auth
  };
  _.extend(this.getOpts, this.options.requestOpts);

  if (this.options.autoStart) {
    this.start();
  }
};

// inherit from EventEmitter
util.inherits(FeedReader, EventEmitter);


//
// Start calling the read function on interval
//
FeedReader.prototype.start = function(begin) {
  if (begin == null) begin = true;
  this.intervalid = this.readInterval(this.options.interval, null, begin);
};


//
// Stop interval if any
//
FeedReader.prototype.stop = function() {
  if (this.intervalid) {
    clearInterval(this.intervalid);
    delete this.intervalid;
  }
};


//
// Reads feed and determines if there are any new items
// emits new items through event `item`
// if there are new items, emits `items` event at end with all items
//
// if callback is given, calls callback with all new items
// even when there are 0
//
FeedReader.prototype.read = function(callback) {
  var self = this;
  var ended = false;

  function error(err) {
    ended = true;
    req.abort();
    if (typeof callback === 'function') {
      callback(err);
    } else {
      self.emit('error', err);
    }
  }

  function success(results, abort) {
    ended = true;
    if (abort) {
      req.abort();
    }
    if (typeof callback === 'function') {
      callback(null, results);
    }
  }

  var req = this.r.get(this.getOpts, function(res) {
    res.setEncoding('utf8');

    // check the response is successful
    if (res.statusCode !== 200) {

      // check if not modified code is sent back
      // in this case, the body will be empty
      if (res.statusCode === 304) {
        return success([]);
      }

      return error(new Error('Status Code: ' + res.statusCode));
    }


    // check headers for conditional get
    if (res.headers['last-modified']) {
      self.getOpts['If-Modified-Since'] = res.headers['last-modified'];
    }
    if (res.headers.etag) {
      self.getOpts['If-None-Match'] = res.headers.etag;
    }


    // create feed parser
    var parser = new FeedMe();

    // listen for parsing errors
    parser.on('error', error);

    // save date
    var date;
    var getdate = function(text) {
      return date = text;
    };

    // try to get date from one of the fields
    parser.once('pubdate', getdate);
    parser.once('lastbuilddate', getdate);
    parser.once('updated', getdate);


    // change interval time if ttl available
    if (!self.options.forceTimeout) {
      parser.once('ttl', function(minutes) {
        minutes = parseInt(minutes);

        // only update if ttl is longer than requested interval
        if (minutes > self.options.timeout) {
          self.options.timeout = minutes;
          if (self.intervalid) {
            self.start(false);
          }
        }
      });
    }


    // listen for skipHours if enabled
    if (self.options.skipHours) {
      parser.once('skiphours', function(data) {
        var hours = data.hour;

        self.options.hours = Array.isArray(hours) ?
          data.hour.map(function(h) {
            return parseInt(h);
          }) : [parseInt(hours)];
      });
    }

    // listen for skipDays if enabled
    if (self.options.skipDays !== false) {
      parser.once('skipdays', function(data) {
        var days = data.day;
        self.options.days = Array.isArray(days) ? days : [days];
      });
    }


    // compare date when first itema is encountered
    var firstitem = function(item) {

      // if date is the same as last, abort
      if (self.options.lastDate === date) {
        return success([], true);
      }

      // if skipHours or skipDays are enabled and feed provides hours/days
      // to skip and it's one of those hours/days, abort
      if (self.options.skipHours || self.options.skipDays) {
        var now = new Date();
        if ((self.options.hours &&
             self.options.hours.indexOf(now.getHours()) !== -1) ||
            (self.options.days &&
             self.options.days.indexOf(DAYS[now.getDay()]) !== -1)) {
          return success([], true);
        }
      }

      // continue if dates differ
      self.options.lastDate = date;
      parser.on('item', getitems);
      getitems(item);
    };

    parser.once('item', firstitem);

    var newitems = [];
    var getitems = function(item) {
      // check if this item has already been read
      // in previous requests
      if (self.options.history.length > 0) {
        var iterator = function(hitem) {
          return _.isEqual(hitem.title, item.title) &&
            ((!hitem.pubdate && !hitem.published) ||
             (hitem.pubdate && hitem.pubdate === item.pubdate) ||
             (hitem.published && hitem.published === item.published));
        };

        // if it has, then stop parsing the rest of the document
        if (_.detect(self.options.history, iterator)) {
          req.abort();
          parser.removeListener('item', getitems);
          end();
          return;
        }
      }

      // if it's new, then put it on the list of new items
      newitems.push(item);
    };


    // take note if this is the first time read has been called
    var first = self.options.history.length === 0;


    // called when there are new items and all of them have
    // been read either by running into an old item
    // or by reaching the end of the feed
    var end = function() {
      // concat new items to the front of the history list
      // cut off history array to save memory
      if (newitems.length > self.options.maxHistory) {
        self.options.history = newitems.slice(0, self.options.maxHistory);
      } else {
        self.options.history = newitems
          .concat(self.options.history
            .slice(0, self.options.maxHistory - newitems.length));
      }

      // only emit new items if this is not the first requrest
      // or if emitOnStart is enabled
      if (newitems.length > 0 && (!first || self.options.emitOnStart)) {

        // reverse order to emit items in chronological order
        newitems.reverse();

        for (var i = 0, l = newitems.length; i < l; i++) {
          self.emit('item', newitems[i], i);
        }

        self.emit('items', newitems, self.options.lastDate);
        success(newitems);
      } else {
        success([]);
      }
    };


    // pipe data from response to parser
    res.on('data', function(chunk) {
      parser.write(chunk);
    });

    res.on('end', function() {
      parser.done();
      if (!ended) end();
    });
  });

  req.on('error', error);
};


//
// starts calling the read fuction in an interval
// passes callback to read
// if begin is true, call read immediately
//
FeedReader.prototype.readInterval = function(callback, interval, begin) {
  var self = this;
  this.stop();

  // allow callback argument to be optional
  if (typeof callback === 'number') interval = callback;
  interval = parseInt(interval);

  if (interval > 0) {
    if (begin) this.read(callback);

    return setInterval(function() {
      return self.read(callback);
    }, interval * 60000);
  }
};
