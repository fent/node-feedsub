(function() {
  var DAYS, EventEmitter, FeedMe, FeedReader, http, https, url, _;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

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
        forceInterval: false,
        autoStart: false,
        emitOnStart: false,
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
      this.getOpts = {
        host: parsed.host,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || '') + (parsed.hash || ''),
        auth: parsed.auth
      };
      _.extend(this.getOpts, this.options.requestOpts);
      if (this.options.autoStart) this.start();
    }

    FeedReader.prototype.start = function(begin) {
      if (begin == null) begin = true;
      return this.intervalid = this.readInterval(this.options.interval, null, begin);
    };

    FeedReader.prototype.stop = function() {
      if (this.intervalid) return clearInterval(this.intervalid);
    };

    FeedReader.prototype.read = function(callback) {
      var req;
      var _this = this;
      req = this.r.get(this.getOpts, function(res) {
        var date, end, err, first, firstitem, getdate, getitems, newitems, parser;
        res.setEncoding('utf8');
        if (res.statusCode !== 200) {
          err = new Error('Status Code: ' + res.statusCode);
          if (typeof callback === 'function') {
            return callback(err);
          } else {
            return _this.emit('error', err);
          }
        }
        parser = new FeedMe();
        parser.on('error', function(err) {
          if (typeof callback === 'function') {
            callback(err);
          } else {
            _this.emit('error', err);
          }
          return req.abort();
        });
        date = false;
        getdate = function(text) {
          return date = text;
        };
        parser.once('pubdate', getdate);
        parser.once('lastbuilddate', getdate);
        parser.once('updated', getdate);
        first = _this.options.history.length === 0;
        if (!_this.options.forceTimeout) {
          parser.once('ttl', function(minutes) {
            minutes = parseInt(minutes);
            if (minutes > _this.options.timeout) {
              _this.options.timeout = minutes;
              if (_this.intervalid) return _this.start(false);
            }
          });
        }
        if (_this.options.skipHours !== false) {
          parser.once('skiphours', function(data) {
            var hour;
            return _this.options.hours = (function() {
              var _i, _len, _ref, _results;
              _ref = data.hour;
              _results = [];
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                hour = _ref[_i];
                _results.push(parseInt(hour));
              }
              return _results;
            })();
          });
        }
        if (_this.options.skipDays !== false) {
          parser.once('skipdays', function(data) {
            return _this.options.days = data.day;
          });
        }
        firstitem = function(item) {
          var now;
          if (_this.options.skipHours || _this.options.skipDays) {
            now = new Date();
            if ((_this.options.hours && _this.options.hours.indexOf(now.getHours()) !== -1) || (_this.options.days && _this.options.days.indexOf(DAYS[now.getDay()]) !== -1)) {
              req.abort();
              if (typeof callback === 'function') return callback(null, []);
              return;
            }
          }
          if (_this.options.lastDate === date) {
            req.abort();
            if (typeof callback === 'function') return callback(null, []);
          }
          _this.options.lastDate = date;
          parser.on('item', getitems);
          return getitems(item);
        };
        parser.once('item', firstitem);
        newitems = [];
        getitems = function(item) {
          var iterator;
          if (_this.options.history.length > 0) {
            iterator = function(hitem) {
              return _.isEqual(hitem.title, item.title) && ((!(hitem.pubdate != null) && !(hitem.published != null)) || ((hitem.pubdate != null) && hitem.pubdate === item.pubdate) || ((hitem.published != null) && hitem.published === item.published));
            };
            if (_.detect(_this.options.history, iterator)) {
              req.abort();
              parser.removeListener('item', getitems);
              end();
              return;
            }
          }
          return newitems.push(item);
        };
        end = function() {
          var i, item, _len, _results;
          if (newitems.length > _this.options.maxHistory) {
            _this.options.history = newitems.slice(0, _this.options.maxHistory);
          } else {
            _this.options.history = newitems.concat(_this.options.history.slice(0, _this.options.maxHistory - newitems.length));
          }
          newitems.reverse();
          if (!first || _this.options.emitOnStart) {
            if (typeof callback === 'function') callback(null, newitems);
            _this.emit('items', newitems, _this.options.lastDate);
            _results = [];
            for (i = 0, _len = newitems.length; i < _len; i++) {
              item = newitems[i];
              _results.push(_this.emit('item', item, i));
            }
            return _results;
          }
        };
        res.on('data', function(chunk) {
          return parser.write(chunk);
        });
        return res.on('end', function() {
          parser.done();
          return end();
        });
      });
      return req.on('error', function(err) {
        if (typeof callback === 'function') {
          return callback(err);
        } else {
          return _this.emit('error', err);
        }
      });
    };

    FeedReader.prototype.readInterval = function(callback, interval, begin) {
      var _this = this;
      this.stop();
      if (typeof callback === 'number') interval = callback;
      interval = parseInt(interval);
      if (interval > 0) {
        if (begin) this.read(callback);
        return setInterval(function() {
          return _this.read(callback);
        }, interval * 60000);
      }
    };

    return FeedReader;

  })();

  module.exports = FeedReader;

}).call(this);
