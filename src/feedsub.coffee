{EventEmitter} = require 'events'
url            = require 'url'
http           = require 'http'
https          = require 'https'
_              = require 'underscore'
FeedMe         = require 'feedme'


DAYS = [
  'Sunday'
  'Monday'
  'Tuesday'
  'Wednesday'
  'Thursday'
  'Friday'
  'Saturday'
]

class FeedReader extends EventEmitter
  constructor: (feed, @options = {}) ->
    _.defaults(@options, {
      interval: 10
      forceInterval: true
      autoStart: false
      emitOnStart: true
      lastDate: null
      history: []
      maxHistory: 50
      skipHours: false
      skipDays: false
    })

    parsed = url.parse feed
    switch parsed.protocol
      when 'http:'
        @r = http
      when 'https:'
        @r = https
    @getOpt =
      host: parsed.host
      path: parsed.pathname + (parsed.search or '') + (parsed.hash or '')
    _.extend @getOpt, @options.get

    if @options.autoStart
      @start()


  start: (begin = true) ->
    @intervalid = @readInterval @options.interval, null, begin

  stop: ->
    if @intervalid
      clearInterval @intervalid


  read: (callback) ->
    req = @r.get @getOpt, (res) =>
      res.setEncoding 'utf8'
      if res.statusCode isnt 200 and typeof callback is 'function'
        return callback new Error 'Status Code: ' + res.statusCode

      parser = new FeedMe()
      parser.on 'error', (err) =>
        if typeof callback is 'function'
          callback err
        else
          @emit 'error', err
        res.pause()
        req.abort()

      # save date
      date = false
      getdate = (text) ->
        date = text

      parser.once 'pubdate', getdate
      parser.once 'lastbuilddate', getdate
      parser.once 'updated', getdate

      first = @options.history.length is 0


      # change interval if ttl available
      if not @options.forceTimeout
        parser.once 'ttl', (minutes) =>
          minutes = parseInt minutes
          if minutes > @options.timeout
            @options.timeout = minutes
            if @intervalid
              @start(false)

      if @options.skipHours isnt false
        parser.once 'skiphours', (data) =>
          @options.hours = (parseInt(hour) for hour in data.hour)

      if @options.skipDays isnt false
        parser.once 'skipdays', (data) =>
          @options.days = data.day


      # compare date on first item
      # if date is the same as long time, abort
      firstitem = (item) =>
        if @options.skipHours or @options.skipDays
          now = new Date()
          if (@options.hours and @options.hours.indexOf(now.getHours()) isnt -1) or (@options.days and @options.days.indexOf(DAYS[now.getDay()]) isnt -1)
            res.pause()
            req.abort()
            return callback null, [] if typeof callback is 'function'
            return

        if @options.lastDate is date
          res.pause()
          req.abort()
          return callback null, [] if typeof callback is 'function'
        @options.lastDate = date
        parser.on 'item', getitems
        getitems(item)

      parser.once 'item', firstitem

      newitems = []
      getitems = (item) =>
        # check if the item has already been read
        # in previous requests
        if @options.history.length > 0
          iterator = (historyitem) ->
            _.isEqual historyitem, item

          # if it has, then stop parsing the rest of the xml
          if _.detect @options.history, iterator
            res.pause()
            req.abort()
            parser.removeListener 'item', getitems
            end()
            return

        # if it's new, then put it on the list of new items
        newitems.push item


      # called when there are new items and all of them have
      # been read either by running into an old item
      # or by reading the whole feed
      end = =>
        # concat new items to the front of the history list
        @options.history = newitems.concat(@options.history)

        # cut off the array to save memory
        @options.history =
          @options.history.slice(0, @options.maxHistory)


        # reverse order to emit items in chronological order
        newitems.reverse()

        # only emit new items if this is not the first request
        # or if emitOnStart is enabled
        if not first or @options.emitOnStart
          callback null, newitems if typeof callback is 'function'
          @emit 'items', newitems, @options.lastDate
          for item, i in newitems
            @emit 'item', item, i


      res.on 'data', (chunk) ->
        parser.write chunk

      res.on 'end', ->
        parser.done()
        end()


  readInterval: (callback, interval, begin) ->
    @stop()

    if typeof callback is 'number'
      interval = callback
    
    interval = parseInt interval
    if interval > 0
      if begin
        @read callback
      setInterval =>
        @read callback
      , interval * 60000


module.exports = FeedReader
