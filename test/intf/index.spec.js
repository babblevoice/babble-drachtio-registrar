/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const Registrar = require( "../../index.js" )

/*
  Assertions
*/

describe( "babble-drachtio-registrar", function() {

  it( "emits the register event with an object containing information on the registration if the Registrar instance reg method is called", function() {

    const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

    const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
    const res = { send: () => {} }

    const intercept = options => ( request, response, cb ) => { cb() }

    registrar.on( "register", ( reg ) => {
      reg.should.be.an( "object" )
      reg.should.have.keys( [
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
      ] )
      reg.should.have.property( "callid", "some_call-id" )
    } )

    registrar.reg( req, res, () => {}, intercept )

    registrar.domains.get( "some.realm" ).users.get( "some_username" ).remove( "some_call-id" )

  } )
} )
