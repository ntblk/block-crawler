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
const supercrawler = require("supercrawler");
const URL = require('url');
const parseLinkHeader = require('parse-link-header');
const UrlPattern = require('url-pattern');
const EventEmitter = require('events');
const typeis = require('type-is').is;
const cheerio = require("cheerio");
const urlMod = require("url");

const AGENT = {
  name: "block-crawler",
  version: "0.1",
};


class BlockCrawler extends EventEmitter {
  constructor(argv) {
    super();
    this.init(argv);
  }

  // Test and possible transform url object
  // TODO: make arg immutable
  shouldCrawl(uri,allowedDomains) {
    if (typeof uri == "string") {
      try {
        uri = URL.parse(uri)
      } catch (err) {
        console.error(err)
      }
    }

    if (!(uri.hostname in allowedDomains)) {
      return false;
    } else {
      var pattern = new UrlPattern(allowedDomains[uri.hostname]);
      var parts = pattern.match(uri.pathname);
      if (parts){
        return true;
      }else{
        return false;
      }
    }
  }

  _htmllinkparser(opts) {
    if (!opts) {
      opts = {};
    }
    var shouldCrawl = this.shouldCrawl;
    var allowedDomains = this.allowedDomains;
    return function(context) {

      var $;
      $ = context.$ || cheerio.load(context.body);
      context.$ = $;
      return $("a[href], link[href][rel=alternate]").map(function() {
        var $this,
          targetHref,
          absoluteTargetUrl,
          urlObj,
          protocol,
          hostname;

        $this = $(this);
        targetHref = $this.attr("href");
        absoluteTargetUrl = urlMod.resolve(context.url, targetHref);
        urlObj = urlMod.parse(absoluteTargetUrl);
        protocol = urlObj.protocol;
        hostname = urlObj.hostname;


        if (protocol !== "http:" && protocol !== "https:") {
          return null;
        }

        if (!(shouldCrawl(URL.parse(absoluteTargetUrl),allowedDomains))) {
          return null;
        }

        return urlMod.format({
          protocol: urlObj.protocol,
          auth: urlObj.auth,
          host: urlObj.host,
          pathname: urlObj.pathname,
          search: urlObj.search
        });
      }).get();
    };
  };

  init(argv) {
    this.verbose = !argv.quiet;
    this.proxyUri = argv.proxy;
    this.redisserver = argv.redisserver;
    this.debug = argv.debug;
    var _allowed_domains = argv.allowed_domains;
    if (undefined != _allowed_domains) {
      try{
        this.allowedDomains = JSON.parse(_allowed_domains);
      }catch(err){
        console.error(err);
        return;
      }
    }
    var _crawleroptions = {
      interval: 500,
      concurrentRequestsLimit: 5
    }
    if (this.redisserver) {
      var _redis = URL.parse("tcp://" + this.redisserver);
      _crawleroptions["urlList"] = new supercrawler.RedisUrlList({
        redis: {
          port: _redis.port,
          host: _redis.hostname
        }
      })
    }
    this.c = new supercrawler.Crawler(_crawleroptions);

    if(this.debug) console.log("Installed: " + this.c);

    var _crawler = this;
    this.c.addHandler("text/html", this._htmllinkparser({}));

    this.c.addHandler(function(context) {
      if (context.response.statusCode == 451) {
        var res = {
          // TODO: Use precise request date/time
          date: new Date(),
          creator: AGENT.name,
          version: AGENT.version,
          url: context.url,
          status: context.response.statusCode,
          statusMessage: context.response.statusMessage
        };

        if ("link" in context.response.headers) {
          var linkHeader = parseLinkHeader(context.response.headers['link']);
          if (linkHeader && linkHeader['blocked-by']) {
            res['blockedBy'] = linkHeader['blocked-by'].url;
          }
        }

        _crawler.emit('found', res);

      } else {
        console.log("Passed: " + context.url + " Status: " + context.response.statusCode);
      }
    });

    this.c.on("httpError", function(err, url) {
      console.log("Error: " + url + " (" + err.statusCode + ")");
    });

    this.c.on("crawlurl",function(url){
      if(_crawler.debug) console.log("Now Crawling: " + url);
    })

    this.c.on("crawledurl",function(url,errorcode,statuscode){
      if(_crawler.debug) console.log("Finished: " + url + ", " + statuscode);
    })

    var crwl = this.c;
    this.c.on("urllistcomplete", function() {
      console.log("Done");
      crwl.stop();
    });

  }

  enqueue(href, res) {

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

    if (!this.shouldCrawl(uri,this.allowedDomains))
      return;

    var full_url = uri.href;

    if (this.verbose)
      console.error(full_url);

    this.c.getUrlList().insertIfNotExists(new supercrawler.Url({
      url: full_url
    }));
  }

  queue(url) {
    this.enqueue(url);
  }

  start() {
    this.c.start();
  }

}

module.exports = BlockCrawler;
