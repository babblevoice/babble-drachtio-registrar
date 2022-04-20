
const crypto = require( "crypto" )
const sipauth = require( "babble-drachtio-auth" )

module.exports.calculateauth = ( req, proxyauth, nc = 1 ) => {

  /* add a comma to simplify the regex */
  proxyauth += ","
  let auth = {}

  auth.realm = /[,\s]{1}realm="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.algorithm = /[,\s]{1}algorithm="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.qop = /[,\s]{1}qop="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.nonce = /[,\s]{1}nonce="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.opaque = /[,\s]{1}opaque="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.stale = "true" === /[,\s]{1}stale="?(.+?)[",\s]/.exec( proxyauth )[ 1 ]
  auth.uri = "sip:dummy.com;transport=UDP"

  /* not what the auth object was designed for, but useful */
  let ourauth = sipauth.create()
  ourauth._nonce = auth.nonce
  ourauth._qop = auth.qop

  let ncstr = ( "" + nc ).padStart( 8, "0" )

  let cnonce = crypto.randomBytes( 8 ).toString( "hex" )
  let hash = ourauth.calcauthhash( "bob", "biloxi", "dummy.com", "sip:dummy.com;transport=UDP", "REGISTER", cnonce, ncstr )

  let authstr = `Digest username="bob",
realm="${auth.realm}",
nonce="${auth.nonce}",
uri="${auth.uri}",
qop=auth,
algorithm=MD5,
nc=${ncstr},
cnonce="${cnonce}",
response="${hash}",
opaque="${auth.opaque}"`

  req.set( "Proxy-Authorization", authstr )
}
