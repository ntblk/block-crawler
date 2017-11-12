# Installing and running block-crawler

Pre-requisites
--------------

You need Node.js (version >= 8) and npm or a compatible package manager.

Installing dependencies
-----------------------

npm install

Running
-------

Simplest run:

```
node index.js http://starting.point.example/
```

(The Node.js executable may be named "nodejs" on your system)

Running with a collector:

```
node index.js --collector https://collector.example/ http://starting.point.example/
```

The collector has to be able to receive POST results and do something
with them. A very limited collector in Python+WSGI is:

```
def store(start_response, environ):
    fileo = open("/var/storage/store.log", 'a')
    status = '200 OK'
    data = environ['wsgi.input'].read()
    fileo.write(data)
    fileo.close()
    output = "Stored %i bytes\n" % len(data)
    response_headers = [('Content-Type', 'text/plain'),
                        ('Content-Length', str(len(output)))]
    start_response(status, response_headers)
    return [output]
```
	
The results (only the HTTP errors) will appear in JSON format in
`/var/storage/store.log`, for instance:

```
{"date":"2017-11-11T12:10:07.314Z","creator":"block-crawler","version":"0.1","url":"https://httpbin.org/status/451","status":451,"statusText":"Unavailable For Legal Reasons"}
```
