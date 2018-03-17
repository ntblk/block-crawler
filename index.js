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

const BlockCrawler = require('./crawler');
const Base64 = require('js-base64').Base64;
const axios = require('axios');

const argv = require('yargs')
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    default: false
  })
  .option('obfuscate', {
    type: 'boolean',
    default: false
  })
  .option('mode', {
    type: 'string',
    default: [],
  })
  .option('collector', {
    type: 'string',
    description: 'Post JSON observations to this URL'
  })
  .option('redisserver', {
    type: 'string',
    description: 'IP address and port of redis server'
  })
  //.demandCommand(1)
  .argv;


var externalIP;

var bc = new BlockCrawler(argv);

bc.on('found', res => {

  res.clientIP = externalIP;

  if (argv.obfuscate) {
    res.urlEncoded = Base64.encode(res.url);
    delete res.url;
  }

  console.log(JSON.stringify(res));

  if (argv.collector)
    axios.post(argv.collector, res)
      .then(function (response) {
      })
      .catch(function (error) {
        console.error(error);
      });
});

// TODO: Use same HTTP backend as crawler to determine IP
// TODO: Don't hardcode IP discovery service
axios.get('https://api.ipify.org')
.then(res => {
  externalIP = res.data;
}).then(() => {
  console.log("External IP: " + externalIP);
  argv._.forEach(url => bc.queue(url));
  bc.start();
});
