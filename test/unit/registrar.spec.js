/*
  Dependencies
*/

const { EventEmitter } = require( "events" )

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const Registrar = require( "../../lib/registrar.js" )

/*
  Assertions
*/

describe( "registrar.js", function() {

  it( "exports the Registrar class", function() {

    Registrar.name.should.equal( "Registrar" )
    String( Registrar ).slice( 0, 5 ).should.equal( "class" )

  } )

  describe( "Registrar (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const registrar = new Registrar( { srf: { use: () => {} } } )

      registrar.should.be.an.instanceof( Registrar )

    } )

    describe( "constructor", function() {

      it( "sets the options property to a merger of defaults and options passed", function() {

        const em = new EventEmitter()

        const registrar = new Registrar( { debug: true, em, srf: { use: () => {} } } )

        const options = {
          expires: 3600,
          minexpires: 3600,
          staletime: 300,
          divisor: 1000,
          debug: true,
          em,
          srf: { use: () => {} }
        }

        JSON.stringify( registrar.options ).should.equal( JSON.stringify( options ) )

      } )

      it( "sets the domains property to an empty map", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.should.be.an( "map" )
        registrar.domains.size.should.equal( 0 )

      } )

      it( "calls the options SRF use method passing \"register\" and regparser then \"register\" and Registrar.reg", function() {

        const regparser = () => {}

        let hasAsserted = false

        const intercept = ( event, fn ) => {
          event.should.equal( "register" )
          !hasAsserted
            ? fn.should.equal( regparser ) && ( hasAsserted = true )
            : fn.should.equal( Registrar.prototype.reg )
        }

        const registrar = new Registrar( { srf: { use: intercept } }, regparser )

      } )

      it( "sets the options em property if not set on options passed", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const em = new EventEmitter()

        registrar.options.em.should.eql( em )

      } )

      it( "sets the consolelog method to log to the console \"Registrar: \" plus a message passed if the default options debug value is overridden", function() {

        const registrar = new Registrar( { debug: true, srf: { use: () => {} } } )

        registrar.options.consolelog.toString().should.include( "m => {" )
        registrar.options.consolelog.toString().should.include( "console.log( \"Registrar: \" + m )" )

      } )

      it( "sets the consolelog method to an empty function if the default options debug value is not overridden", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.options.consolelog.toString().should.equal( "m => {}" )

      } )
    } )

    describe( "on", function() {

      it( "sets an event listener for an event and a callback passed", function() {

        const em = new EventEmitter()

        const registrar = new Registrar( { em, srf: { use: () => {} } } )

        const intercept = data => {
          data.should.equal( "some_data" )
        }

        registrar.on( "some_event", intercept )

        em.emit( "some_event", "some_data" )

      } )
    } )

    describe( "reg", function() {

      it( "throws an error if the request registrar property is already set", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const invoke = () => { registrar.reg( Request.init(), {}, () => {} ) }

        should.Throw( invoke, "Registrar has been used twice" )

      } )

      it( "invokes the callback if the request method property is not \"REGISTER\"", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        let hasCalled = false
        const intercept = () => { hasCalled = true }

        const req = Request.init( { method: "NOT_REGISTER" }, false ) // no registrar property

        registrar.reg( req, {}, intercept )

        hasCalled.should.equal( true )

      } )

      it( "calls the isauthed method passing the host and username parsed from the request registration AOR property and the request", async function() {

        const registrar = new Registrar( {
          srf: { use: () => {} },
          userlookup: () => new Promise( ( res, rej ) => {} )
        } )

        let hasPassed = false
        const intercept = ( host, username, request ) => {
          if( host === "some.realm" && username === "1000" && request === req ) hasPassed = true
        }

        registrar.isauthed = intercept

        const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

        registrar.reg( req, {}, () => {} )

        hasPassed.should.equal( true )

      } )

      it( "calls the registration onexpire method passing the registration if the request registrar expires property is 0 and the registration is found", function() {

        const registrar = new Registrar( {
          srf: { use: () => {} },
          userlookup: () => new Promise( ( res, rej ) => {} )
        } )

        registrar.isauthed = () => r

        let hasPassed = false
        const intercept = reg => {
          if( reg === r ) hasPassed = true
        }

        const r = { onexpire: intercept, regping: () => {} }

        const req = Request.init( {
          registration: {
            aor: "sip:1000@some.realm",
            expires: 0
          }
        }, false ) // no registrar property

        registrar.reg( req, { send: () => {} }, () => {} )

        hasPassed.should.equal( true )

      } )
    } )

    describe( "isauthed", function() {

      it( "returns false if the realm passed is not present on the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.isauthed( "some.realm", "some_user", {} ).should.equal( false )

      } )

      it( "returns false if the user passed is not present on the realm passed", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user1", {} )

        registrar.isauthed( "some.realm", "some_user2", {} ).should.eql( false )

      } )

      const baseR = {
        callid: "some_call-id",
        network: {
          source_address: "some_source_address",
          source_port: "some_source_port"
        }
      }

      const testValues = [
        { name: "source address", key: "source_address", mismatch: "some_other_source_address" },
        { name: "source port", key: "source_port", mismatch: "some_other_source_port" },
        { name: "call ID", key: "callid", mismatch: "some_other_call-id" }
      ]

      testValues.forEach( testValue => {

        it( `returns false if the request ${ testValue.name } does not match that on the network property of the registration corresponding to the call ID`, function() {

          const registrar = new Registrar( { srf: { use: () => {} } } )

          const u = { registrations: new Map() }
          const r = JSON.parse( JSON.stringify( baseR ) )

          testValue.key.includes( "source_" )
            ? ( r.network[ testValue.key ] = testValue.mismatch )
            : ( r[ testValue.key ] = testValue.mismatch )

          u.registrations.set( "some_call-id", r )

          registrar.domains.set( "some.realm", { users: new Map() } )
          registrar.domains.get( "some.realm" ).users.set( "some_user", u )

          const retVal = registrar.isauthed( "some.realm", "some_user", Request.init() ) // see Request.defaultValues for source_address, source_port and call-id value

          retVal.should.equal( false )

        } )
      } )

      it( "returns the registration corresponding to the call ID if the request source address, source port and call ID match those on the registration network property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }
        const r = JSON.parse( JSON.stringify( baseR ) )

        u.registrations.set( "some_call-id", r )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user", u )

        const retVal = registrar.isauthed( "some.realm", "some_user", Request.init() ) // see Request.defaultValues for source_address, source_port and call-id value

        retVal.should.equal( r )

      } )
    } )

    describe( "realms", function() {

      it( "returns an array containing the keys of the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some_key1", "some_value1" )
        registrar.domains.set( "some_key2", "some_value2" )

        registrar.realms().should.eql( [ "some_key1", "some_key2" ] )

      } )
    } )

    describe( "users", function() {

      it( "returns an empty array if the key passed is not present on the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.users( "some.domain" ).should.eql( [] )

      } )

      it( "calls the domain info method, returning the result, for a value on the domains property corresponding to the key passed if present", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const intercept = () => [ "some_info" ]

        registrar.domains.set( "some.domain", { info: intercept } )

        registrar.users( "some.domain" ).should.eql( [ "some_info" ] )

      } )
    } )

    describe( "user", function() {

      it( "parses the host and username from the realm if username not passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }
        const r = { info: () => "some_info" }

        u.registrations.set( "some_call-id", r )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "1000", u )

        const ua = await registrar.user( "sip:1000@some.realm" )

        ua[ 0 ].should.equal( "some_info" )

      } )

      it( "returns an empty array if the realm passed is not present on the domains property", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const result = await registrar.user( "some.realm", "some_user" )

        result.should.eql( [] )

      } )

      it( "returns an empty array if the username passed is not present on the realm passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user1", {} )

        const result = await registrar.user( "some.realm", "some_user2" )

        result.should.eql( [] )

      } )

      it( "returns an array containing info for each registration for the username passed at the realm passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }

        const r1 = { info: () => "some_info1" }
        const r2 = { info: () => "some_info2" }

        u.registrations.set( "some_call-id1", r1 )
        u.registrations.set( "some_call-id2", r2 )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user", u )

        const ua = await registrar.user( "some.realm", "some_user" )

        ua[ 0 ].should.equal( "some_info1" )
        ua[ 1 ].should.equal( "some_info2" )

      } )
    } )
  } )
} )
