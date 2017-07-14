const BlockCrawler = require('./crawler');

var myCrawler = new BlockCrawler();
//c.queue('https://www.reddit.com/r/tw' + 'inks/');
myCrawler.queue('http://redditlist.com/nsfw');

myCrawler.on('found', res => {
  console.log(res);
});
