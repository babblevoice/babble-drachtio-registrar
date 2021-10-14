/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

// const Srf = require( "drachtio-srf" )
const Registrar = require( "../../index.js" )

/*
  Assertions
*/

// const srf = new Srf()
// srf.connect( { host: "127.0.0.1", port: 9022 } )

// srf.on( "connect", ( err, hostport ) => {
//   console.log( `Connected to a drachtio server listening on: ${hostport}` )
// } )

describe( "events", function() {

  const regInfoKeys = [
    "uuid",
    "initial",
    "callid",
    "contacts",
    "aor",
    "expires",
    "authorization",
    "registeredat",
    "useragent",
    "allow",
    "network",
    "expiresat",
    "expiresin",
    "stale"
  ]

  describe( "register", function() {

    it( "emits with an object containing information on the registration if the Registrar instance reg method is called", function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
      const res = { send: () => {} }

      const intercept = options => ( request, response, cb ) => { cb() }

      registrar.on( "register", ( reg ) => {
        reg.should.be.an( "object" )
        reg.should.have.keys( regInfoKeys )
        reg.should.have.property( "callid", "some_call-id" )
      } )

      registrar.reg( req, res, () => {}, intercept )

      registrar.domains.get( "some.realm" ).users.get( "some_username" ).remove( "some_call-id" )

    } )
  } )

  describe( "unregister", function() {

    it( "emits with an object containing information on the registration on registration expiry", function( done ) {

      const registrar = new Registrar( { expires: 1, srf: { use: () => {} }, regping: () => {} } )

      const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
      const res = { send: () => {} }

      const intercept = options => ( request, response, cb ) => { cb() }

      registrar.on( "unregister", ( reg ) => {
        reg.should.be.an( "object" )
        reg.should.have.keys( regInfoKeys )
        reg.should.have.property( "callid", "some_call-id" )
        done()
      } )

      registrar.reg( req, res, () => {}, intercept )

    } )

    it( "emits with an object containing information on the registration if the reg instance remove method is called", function( done ) {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
      const res = { send: () => {} }

      const intercept = options => ( request, response, cb ) => { cb() }

      registrar.on( "unregister", ( reg ) => {
        reg.should.be.an( "object" )
        reg.should.have.keys( regInfoKeys )
        reg.should.have.property( "callid", "some_call-id" )
        done()
      } )

      registrar.reg( req, res, () => {}, intercept )

      registrar.domains.get( "some.realm" ).users.get( "some_username" ).remove( "some_call-id" )

    } )
  } )
} )
