const Crawler = require("crawler");
const seenreq = require('seenreq');
const { URL } = require('url');
const parseLinkHeader = require('parse-link-header');
const UrlPattern = require('url-pattern');
const EventEmitter = require('events');

class BlockCrawler extends EventEmitter {
}

var myCrawler = new BlockCrawler();

var seen = new seenreq();

var c = new Crawler({
    maxConnections : 10,
    timeout : 15000,
    // This will be called for each crawled page
    callback : processResponse
});

function processResponse (error, res, done) {
  if (error) {
    console.log('error: ' + error);
  } else {
    // https://tools.ietf.org/html/rfc7725
    if (res.statusCode === 451) {
      // NOTE: reddit.com 451 pages deliver HTML body without content-type header

      var o = {
        // TODO: Use precise request date/time
        date: new Date(),
        url: res.request.uri.href,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage
      };

      // When an entity blocks access to a resource and returns status 451, it
      // SHOULD include a "Link" HTTP header field [RFC5988]

      // statusCode: 451,
      // statusMessage: 'Unavailable For Legal Reasons',
      //   link: '<https://www.reddit.com>; rel="blocked-by"',

      var linkHeader = parseLinkHeader(res.headers['link']);
      if (linkHeader && linkHeader['blocked-by'])
        o.blockedBy = linkHeader['blocked-by'];

      myCrawler.emit('found', o);
      console.log(o);
    }

    if (res.statusCode === 200) {
      scrape(res);
    }
  }

  done();
}

function scrape (res) {
  var $ = res.$;
  //console.log($("title").text());
  $('a').each(function(index, node) {
    var $node = $(node);

    try {
      var rel = $node.attr('rel') || '';
      rel = rel.split(/ +/);
      if (rel.indexOf('nofollow') !== -1)
        return;
      var href = $node.attr('href').split('#')[0];
    } catch (err) {
      // TODO: Handle malformed URLs instead of this catch-all
      return;
    }

    enqueue(href, res);
  });
}

// Test and possible transform url object
// TODO: make arg immutable
function shouldCrawl (uri) {
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

function enqueue (href, res) {
  // TODO: Limit domain, URL etc.

  var base_url = res.request.uri.href;
  //var full_url = res.request.uri.resolve(href);
  // TODO: Respect meta base URL tag?
  //var full_url = url.resolve(base_url, href);

  try {
    var uri = new URL(href, res.request.uri.href);
  } catch (err) {
    // parse error
    return;
  }

  if (!shouldCrawl(uri))
    return;

  var full_url = uri.href;

  try {
    if (seen.exists(full_url))
      return;
  } catch (err) {
    // normalize() : URIError: URI malformed
    return;
  }

  //console.error('enqueue: ' + full_url);
  c.queue({
    uri: full_url,
    referer: base_url,
  });
}

//c.queue('https://www.reddit.com/r/tw' + 'inks/');
c.queue('http://redditlist.com/nsfw');
//c.queue('https://www.reddit.com/r/Turkey/');
