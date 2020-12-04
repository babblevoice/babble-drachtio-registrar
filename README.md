A simple SIP Registrar to be used with the drachtio SIP middleware server. The server maintains all registered endpoints by domain. Each endpoint is polled using SIP OPTIONS.

Usage

```javascript
const Srf = require( "drachtio-srf" )
const Registrar = require( "babble-drachtio-registrar" )
const config = require( "config" )

const srf = new Srf()
srf.connect( {
  host: config.drachtio.host,
  port: config.drachtio.port,
  secret: config.drachtio.secret
} )

srf.on( "connect", ( err, hostport ) => {
  console.log( `Connected to a drachtio server listening on: ${hostport}` )
} )

const r = new Registrar( { "srf": srf, "config": config, "passwordLookup": ( username, realm, callback ) => {

    realm = realm.split( "." ).reverse().join( "." )
    let key = "directory." + realm + "." + username
    if( !config.has( key ) ) {
      return callback( null, false )
    }

    key += ".secret"
    return callback( null, config.get( key ) )
  }
} )

```

An example config file to be used with this example (config/default.json)

```json
{
  "drachtio": {
    "host": "127.0.0.1",
    "port": 9022,
    "secret": "cymru"
  },
  "directory": {
    "com": {
      "babblevoice": {
        "bling": {
          "1000": { "secret": "<yourpassword>" },
          "1001": { "secret": "<yourpassword>" }
        }
      }
    }
  }
}

```

Our registrar then makes available registered endpoints.

```javascript
r.realms()
r.users( "bling.babblevoice.com" )
r.user( "bling.babblevoice.com", "1000" )

```

In this example, we create a control web server to expose registration information.
```javascript
let handlers = { 'PUT': {}, 'POST': {}, 'DELETE': {}, 'GET': {} }

handlers.GET.reg = (  pathparts, req, res, body  ) =>
{
  res.writeHead( 200, { "Content-Type": "application/json" } )

  if( 1 == pathparts.length ) {
    res.write( JSON.stringify( r.realms() ) )
  }
  else if( 2 == pathparts.length ){
    res.write( JSON.stringify( r.users( pathparts[ 1 ] ) ) )
  }
  else if( 3 == pathparts.length ){
    res.write( JSON.stringify( r.user( pathparts[ 1 ], pathparts[ 2 ] ) ) )
  }

  res.end()
}

const httpserver = http.createServer( ( req, res ) =>
{
  let body = ""
  req.on( "data", ( chunk ) =>
  {
    body += chunk.toString()
  } )

  req.on( "end", () => {
    var urlparts = url.parse( req.url )
    /* Remove the leading '/' */
    var path = urlparts.path.substr( 1 )
    var pathparts = path.split( '/' )

    if( req.method in handlers && pathparts[ 0 ] in handlers[ req.method ] )
    {
      try {
        handlers[ req.method ][ pathparts[ 0 ] ]( pathparts, req, res, body )
      }
      catch( err ) {
        res.writeHead( 500, { "Content-Type": "application/json" } )
        res.write( `{ "error": "${err.message}" }` )
        res.end()
      }
    }
    else
    {
      console.log( "Unknown method " + req.method + ":" + url )
      res.writeHead( 404, { "Content-Length": "0" } )
      res.end()
    }
  } )
} )



httpserver.on( "clientError", ( err, socket ) => {
  if ( err.code === "ECONNRESET" || !socket.writable ) {
    return
  }

  socket.end( "HTTP/1.1 400 Bad Request\r\n\r\n" )
} )


httpserver.listen( 9000, "127.0.0.1" )
```
