// Copyright (c) 2017 Alp Toker, netblocks.org
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*
A crawler module to detect legally restricted web content:
  https://tools.ietf.org/html/rfc7725
*/
const Crawler = require('crawler');
const seenreq = require('seenreq');
const URL = require('url');
const parseLinkHeader = require('parse-link-header');
const UrlPattern = require('url-pattern');
const EventEmitter = require('events');
const typeis = require('type-is').is;

const AGENT = {
  name: "block-crawler",
  version: "0.1",
};

class BlockCrawler extends EventEmitter {
  constructor() {
    super();
    this.init();
  }

  init() {
    this.seen = new seenreq();
    this.modes = [];

    this.c = new Crawler({
        maxConnections : 10,
        timeout : 15000,
        maxRedirects : 3,
        // This will be called for each crawled page
        callback : this.processResponse.bind(this)
    });
  }

  processResponse (error, res, done) {
    if (error) {
      console.error('error: ' + error);
    } else {
      // https://tools.ietf.org/html/rfc7725
      if (res.statusCode === 451) {
        // NOTE: reddit.com 451 pages deliver HTML body without content-type header

        // Field names loosely inspired by HAR 1.2. Spec. Fields generally optional.
        var o = {
          // TODO: Use precise request date/time
          date: new Date(),
          creator: AGENT.name,
          version: AGENT.version,
          //reporter:,
          url: res.request.uri.href,
          status: res.statusCode,
          statusText: res.statusMessage,
        };

        // When an entity blocks access to a resource and returns status 451, it
        // SHOULD include a "Link" HTTP header field [RFC5988]

        // statusCode: 451,
        // statusMessage: 'Unavailable For Legal Reasons',
        //   link: '<https://www.reddit.com>; rel="blocked-by"',

        var linkHeader = parseLinkHeader(res.headers['link']);
        if (linkHeader && linkHeader['blocked-by'])
          o.blockedBy = linkHeader['blocked-by'];

        this.emit('found', o);
      }

      if (res.statusCode === 200) {
        this.scrape(res);
      }
    }

    done();
  }

  scrape (res) {
    var $ = res.$;
    //console.log($.text());
    var content_type = res.headers['content-type'.toLowerCase()];
    if (!typeis(content_type,['html','xhtml'])){
      return;
    }
    //console.log($("title").text());
    $('a').each((index, node) => {
      var $node = $(node);

      try {
        var rel = $node.attr('rel') || '';
        rel = rel.split(/ +/);
        if (rel.indexOf('nofollow') !== -1)
          return;
        var href = $node.attr('href');
        if(!href)
          return;
        var href = href.split('#')[0];
      } catch (err) {
        // TODO: Handle malformed URLs instead of this catch-all
        return;
      }

      this.enqueue(href, res);
    });
  }

  // Test and possible transform url object
  // TODO: make arg immutable
  shouldCrawl (uri) {
    if (this.modes.indexOf('reddit') !== -1) {
      // TODO: Use the pattern for this instead?
      if (uri.hostname === 'reddit.com' || uri.hostname === 'www.reddit.com') {
        var pattern = new UrlPattern('/r/:subreddit(/)');

        // https://github.com/snd/url-pattern
        var parts = pattern.match(uri.pathname);

        // Upgrade to HTTPS
        if (uri.protocol === 'http:')
          uri.protocol = 'https:';

        return !!parts;
      }

      if (uri.hostname === 'redditlist.com') {
        // TODO: just use a regex instead of pattern?
        var pattern = new UrlPattern('/nsfw(?page=:pg)');
        var parts = pattern.match(uri.pathname);
        return !!parts;
      }

      return false;
    }

    return true;
  }

  enqueue (href, res) {

    // TODO: Limit domain, URL etc.

    var base_url = res ? res.request.uri.href : '';
    //var full_url = res.request.uri.resolve(href);
    // TODO: Respect meta base URL tag?
    //var full_url = url.resolve(base_url, href);

    try {
      var uri = URL.parse(URL.resolve(base_url, href));
    } catch (err) {
      // parse error
      console.error(err);
      return;
    }

    if (!this.shouldCrawl(uri))
      return;

    var full_url = uri.href;
    try {
      if (this.seen.exists(full_url))
        return;
    } catch (err) {
      // normalize() : URIError: URI malformed
      return;
    }

    if (this.verbose)
      console.error(full_url);

    // FIXME: Avoid sending empty string as referer when !req
    this.c.queue({
      uri: full_url,
      referer: base_url,
    });
  }

  queue (url) {
    this.enqueue(url);
  }
}

module.exports = BlockCrawler;
