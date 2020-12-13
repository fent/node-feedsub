import { TypedEmitter } from 'tiny-typed-emitter';
import { default as FeedMe, FeedItem } from 'feedme';
import NewsEmitter from 'newsemitter';
import miniget from 'miniget';
import zlib from 'zlib';


// Used for the skipdays tag.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday'];


export interface Options {
  interval?: number;
  forceInterval?: boolean;
  autoStart?: boolean;
  emitOnStart?: boolean;
  lastDate?: null | string;
  history?: string[];
  maxHistory?: number;
  skipHours?: boolean;
  hoursToSkip?: number[];
  skipDays?: boolean;
  daysToSkip?: string[];
  requestOpts?: miniget.Options;
}

export type DefaultOptions = Required<Options>;

interface FeedSubEvents {
  'error': (err: Error) => void;
  'item': (item: FeedItem) => void;
  'items': (items: FeedItem[]) => void;
}

export { FeedItem } from 'feedme';

export default class FeedSub extends TypedEmitter<FeedSubEvents> {
  public feed: string;
  public options: DefaultOptions;
  public news: NewsEmitter;
  public getOpts: miniget.Options & { headers: Record<string, string> };
  private _first: boolean;
  private _intervalid: number;

  /**
   * @constructor
   * @param {string} feed
   * @param {!Object} options
   */
  constructor(feed: string, options?: Options) {
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
      hoursToSkip   : null,
      skipDays      : false,
      daysToSkip    : null,
      requestOpts   : {},
    }, options);

    // Create news emitter.
    this.news = new NewsEmitter({
      maxHistory: this.options.maxHistory,
      manageHistory: true,
      identifier: (item: any[]) => {
        let feedItem = item[0];
        return [
          feedItem.title,
          feedItem.link,
          feedItem.pubdate,
          feedItem.published,
          feedItem.updated
        ].join(',');
      }
    });

    this.news.addHistory('item', this.options.history);
    this._first = (this.news.history.get('item') as Set<string>).size === 0;
    this.getOpts = Object.assign({
      headers: {} as Record<string, string>,
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
  start(readOnStart?: boolean) {
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
  read(callback?: (err: null | Error, items?: FeedItem[]) => void) {
    let ended = false;
    let req: miniget.Stream;
    let items: FeedItem[] = [];
    let newItems: FeedItem[] = [];
    let sortOrder = 0;

    const error = (err: Error) => {
      ended = true;
      this._first = false;
      if (typeof callback === 'function') {
        callback(err);
      } else {
        this.emit('error', err);
      }
      req.destroy();
    };

    const success = () => {
      if (ended) { return; }
      ended = true;
      if (sortOrder <= 0) {
        newItems.reverse();
      }
      this.news.addHistory('item', newItems.map((item) => [item]));
      if (this._first && !this.options.emitOnStart) {
        newItems = [];
      }
      newItems.forEach(item => this.emit('item', item));
      this.emit('items', newItems);
      if (req) {
        req.destroy();
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
        (!this._first || !this.options.emitOnStart) &&
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
      let date: string;
      let getdate = (text: string) => date = text;

      // Create feed parser.
      const parser = new FeedMe();
      parser.on('error', error);

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
      const firstitem = (item: FeedItem) => {
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

      const getItemDate = (item: FeedItem) => +new Date(item.pubdate as string || item.published as string || 0);
      const getItem = (item: FeedItem) => {
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

      const getOlderItem = (item: FeedItem) => {
        if (this._first) {
          newItems.push(item);
        } else if (!ended) {
          let emitted = this.news.emit('item', item);
          if (emitted) {
            newItems.push(item);
          } else {
            // Check if this item has already been read in previous requests
            // if it has, then stop parsing the rest of the document.
            parser.removeListener('item', getItem);
            success();
          }
        }
      };

      let foundPrevItem = false;
      const getNewerItem = (item: FeedItem) => {
        if (this._first) {
          newItems.push(item);
        } else if (!foundPrevItem && !this.news.emit('item', item)) {
          foundPrevItem = true;
        } else if (foundPrevItem && this.news.emit('item', item)) {
          newItems.push(item);
        }
      };

      req.pipe(parser);

      parser.on('finish', () => {
        if (ended) { return; }
        // Process items in descending order if no order found at end.
        if (sortOrder === 0 && newItems.length === 0) {
          items.forEach(getOlderItem);
        }
        success();
        this._first = false;
      });
    });

    req.on('error', error);
  }
}

module.exports = FeedSub;
