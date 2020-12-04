A simple SIP Registrar to be used with the drachtio SIP middleware server. The server maintains all registered endpoints by domain. Each endpoint is polled using SIP OPTIONS.

Usage

```
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

```
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
