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

describe( "event emission", function() {

  describe( "register", function() {

    it( "is emitted with an object containing information on the registration if the Registrar instance reg method is called with appropriate arguments", function() {

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

      registrar.domains.get( "some.realm" ).users.get( "1000" ).remove( "some_call-id" )

    } )
  } )

  describe( "unregister", function() {

    it( "is emitted with an object containing information on the registration on registration expiry", function( done ) {

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

    it( "is emitted with an object containing information on the registration if the reg instance remove method is called with the correct call ID", function( done ) {

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

      registrar.domains.get( "some.realm" ).users.get( "1000" ).remove( "some_call-id" )

    } )
  } )
} )

describe( "endpoint inspection", function() {

  describe( "realms", function() {

    it( "returns an array containing a list of all domains", function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      testValues = [ "some.realm1", "some.realm2" ]

      testValues.forEach( testValue => {

        const req = Request.init( { authorization: { realm: testValue }, registration: { aor: `sip:1000@${ testValue }` } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => { cb() }

        registrar.reg( req, res, () => {}, intercept )
      } )

      const domains = registrar.realms()

      domains.should.eql( testValues ) // eql for deep equality

      testValues.forEach( testValue => {
        registrar.domains.get( testValue ).users.get( "1000" ).remove( "some_call-id" )
      } )
    } )
  } )

  describe( "users", function() {

    it( "returns an array containing one object per registration at the realm passed, each containing information on the registration", function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      testValues = [

        { username: "1000", callID: "some_call-id1" },
        { username: "1001", callID: "some_call-id1" },
        { username: "1001", callID: "some_call-id2" }
      ]

      testValues.forEach( testValue => {

        const req = Request.init( { headers: { "call-id": testValue.callID }, authorization: { username: testValue.username }, registration: { aor: `sip:${ testValue.username }@some.realm` } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => { cb() }

        registrar.reg( req, res, () => {}, intercept )
      } )

      const users = registrar.users( "some.realm" )

      testValues.forEach( ( testValue, i ) => {

        users[ i ].should.have.keys( regInfoKeys )
        users[ i ].authorization.username.should.equal( testValue.username )
        users[ i ].callid.should.equal( testValue.callID )

        registrar.domains.get( "some.realm" ).users.get( testValue.username ).remove( testValue.callID )
      } )
    } )

    it( "returns an empty array if the realm passed is not present", function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      testValues = [ "some.realm1", "some.realm2" ]

      testValues.forEach( testValue => {

        const req = Request.init( { authorization: { realm: testValue }, registration: { aor: `sip:1000@${ testValue }` } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => { cb() }

        registrar.reg( req, res, () => {}, intercept )

        registrar.domains.get( testValue ).users.get( "1000" ).remove( "some_call-id" )
      } )

      const users = registrar.users( "some.realm3" )

      users.should.eql( [] )

    } )
  } )

  describe( "user", function() {

    it( "returns an empty array if the realm passed is not present", async function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      testValues = [ "some.realm1", "some.realm2" ]

      testValues.forEach( testValue => {

        const req = Request.init( { authorization: { realm: testValue }, registration: { aor: `sip:1000@${ testValue }` } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => { cb() }

        registrar.reg( req, res, () => {}, intercept )

        registrar.domains.get( testValue ).users.get( "1000" ).remove( "some_call-id" )
      } )

      const user = await registrar.user( "sip:1000@some.realm3" )

      user.should.eql( [] )

    } )

    it( "returns an empty array if the username passed is not present", async function() {

      const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

      testValues = [ "1000", "1001" ]

      testValues.forEach( testValue => {

        const req = Request.init( { authorization: { username: testValue }, registration: { aor: `sip:${ testValue }@some.realm` } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => { cb() }

        registrar.reg( req, res, () => {}, intercept )

        registrar.domains.get( "some.realm" ).users.get( testValue ).remove( "some_call-id" )
      } )

      const user = await registrar.user( "sip:1002@some.realm" )

      user.should.eql( [] )

    } )
  } )
} )
