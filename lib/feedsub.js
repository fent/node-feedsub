var EventEmitter = require('events').EventEmitter
  , util         = require('util')
  , _            = require('underscore')
  , FeedMe       = require('feedme')
  , NewsEmitter  = require('newsemitter')
  , request      = require('request')


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
    maxHistory: 10,
    skipHours: false,
    skipDays: false
  });

  // create news emitter
  this.news = new NewsEmitter({
    history: this.options.maxHistory
  , manageHistory: true
  , comparator: function(item, hitem) {
      item = item[1];
      return _.isEqual(hitem.title, item.title) &&
        ((!hitem.link && !item.link) || _.isEqual(hitem.link, item.link)) &&
        ((!hitem.pubdate && !hitem.published) ||
         (hitem.pubdate && hitem.pubdate === item.pubdate) ||
         (hitem.published && hitem.published === item.published));
    }
  });

  this.news.history.item = this.options.history;


  var self = this;
  this.newitems = [];
  this.first = this.news.history.item.length === 0;

  // keep track of and emit new items
  this.news.on('item', function(item) {
    if (!self.first || self.options.emitOnStart) {
      self.newitems.unshift(item);
    }
  });

  this.getOpts = {
    uri: feed
  , onResponse: true
  , encoding: 'utf8'
  , headers: {}
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

  var req = request(this.getOpts, function(err, res) {
    if (err) return error(err);

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
      self.getOpts.headers['If-Modified-Since'] = res.headers['last-modified'];
    }
    if (res.headers.etag) {
      self.getOpts.headers['If-None-Match'] = res.headers.etag;
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

    var getitems = function(item) {
      // check if this item has already been read
      // in previous requests
      // if it has, then stop parsing the rest of the document
      if (!self.news.emit('item', item)) {
        parser.removeListener('item', getitems);
        success(self.newitems);
        return;
      }
    };


    // pipe data from response to parser
    res.on('data', function(chunk) {
      parser.write(chunk);
    });

    res.on('end', function() {
      parser.done();
      if (!ended) success(self.newitems);
    });
  });
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
