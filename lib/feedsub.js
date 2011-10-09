(function() {
  var DAYS, EventEmitter, FeedMe, FeedReader, http, https, url, _;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  EventEmitter = require('events').EventEmitter;
  url = require('url');
  http = require('http');
  https = require('https');
  _ = require('underscore');
  FeedMe = require('feedme');
  DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  FeedReader = (function() {
    __extends(FeedReader, EventEmitter);
    function FeedReader(feed, options) {
      var parsed;
      this.options = options != null ? options : {};
      _.defaults(this.options, {
        interval: 10,
        forceInterval: true,
        autoStart: false,
        emitOnStart: true,
        lastDate: null,
        history: [],
        maxHistory: 50,
        skipHours: false,
        skipDays: false
      });
      parsed = url.parse(feed);
      switch (parsed.protocol) {
        case 'http:':
          this.r = http;
          break;
        case 'https:':
          this.r = https;
      }
      this.getOpt = {
        host: parsed.host,
        path: parsed.pathname + (parsed.search || '') + (parsed.hash || '')
      };
      _.extend(this.getOpt, this.options.get);
      if (this.options.autoStart) {
        this.start(true);
      }
    }
    FeedReader.prototype.start = function(begin) {
      return this.intervalid = this.readInterval(this.options.interval, null, begin);
    };
    FeedReader.prototype.stop = function() {
      if (this.intervalid) {
        return clearInterval(this.intervalid);
      }
    };
    FeedReader.prototype.read = function(callback) {
      var req;
      return req = this.r.get(this.getOpt, __bind(function(res) {
        var date, end, first, firstitem, getdate, getitems, newitems, parser;
        res.setEncoding('utf8');
        if (res.statusCode !== 200 && typeof callback === 'function') {
          return callback(new Error('Status Code: ' + res.statusCode));
        }
        parser = new FeedMe();
        parser.on('error', __bind(function(err) {
          if (typeof callback === 'function') {
            callback(err);
          } else {
            this.emit('error', err);
          }
          res.pause();
          return req.abort();
        }, this));
        date = null;
        getdate = function(text) {
          return date = text;
        };
        parser.once('pubdate', getdate);
        parser.once('lastbuilddate', getdate);
        parser.once('updated', getdate);
        first = this.options.history.length === 0;
        if (!this.options.forceTimeout) {
          parser.once('ttl', __bind(function(minutes) {
            minutes = parseInt(minutes);
            if (minutes > this.options.timeout) {
              this.options.timeout = minutes;
              if (this.intervalid) {
                return this.start(false);
              }
            }
          }, this));
        }
        if (this.options.skipHours !== false) {
          parser.once('skiphours', __bind(function(data) {
            var hour;
            return this.options.hours = (function() {
              var _i, _len, _ref, _results;
              _ref = data.hour;
              _results = [];
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                hour = _ref[_i];
                _results.push(parseInt(hour));
              }
              return _results;
            })();
          }, this));
        }
        if (this.options.skipDays !== false) {
          parser.once('skipdays', __bind(function(data) {
            return this.options.days = data.day;
          }, this));
        }
        firstitem = __bind(function(item) {
          var now;
          if (this.options.skipHours || this.options.skipDays) {
            now = new Date();
            if ((this.options.hours && this.options.hours.indexOf(now.getHours()) !== -1) || (this.options.days && this.options.days.indexOf(DAYS[now.getDay()]) !== -1)) {
              res.pause();
              req.abort();
              if (typeof callback === 'function') {
                return callback(null, []);
              }
              return;
            }
          }
          if (this.options.lastDate === date) {
            res.pause();
            req.abort();
            return callback(null, []);
          }
          this.options.lastDate = date;
          parser.on('item', getitems);
          return getitems(item);
        }, this);
        parser.once('item', firstitem);
        newitems = [];
        getitems = __bind(function(item) {
          var iterator;
          if (this.options.history.length > 0) {
            iterator = function(historyitem) {
              return _.isEqual(historyitem, item);
            };
            if (_.detect(this.options.history, iterator)) {
              res.pause();
              req.abort();
              parser.removeListener('item', getitems);
              end();
              return;
            }
          }
          return newitems.push(item);
        }, this);
        end = __bind(function() {
          var i, item, _len, _results;
          this.options.history = newitems.concat(this.options.history);
          this.options.history = this.options.history.slice(0, this.options.maxHistory);
          newitems.reverse();
          if (!first || this.options.emitOnStart) {
            if (typeof callback === 'function') {
              callback(null, newitems);
            }
            this.emit('items', newitems, this.options.lastDate);
            _results = [];
            for (i = 0, _len = newitems.length; i < _len; i++) {
              item = newitems[i];
              _results.push(this.emit('item', item, i));
            }
            return _results;
          }
        }, this);
        res.on('data', function(chunk) {
          return parser.write(chunk);
        });
        return res.on('end', function() {
          parser.done();
          return end();
        });
      }, this));
    };
    FeedReader.prototype.readInterval = function(callback, interval, begin) {
      this.stop();
      if (typeof callback === 'number') {
        interval = callback;
      }
      interval = parseInt(interval);
      if (interval > 0) {
        if (begin) {
          this.read(callback);
        }
        return setInterval(__bind(function() {
          return this.read(callback);
        }, this), interval * 60000);
      }
    };
    return FeedReader;
  })();
  module.exports = FeedReader;
}).call(this);
