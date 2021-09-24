/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const { clearTimer } = require( "../util/cleanup.js" )

const user = require( "../../lib/user.js" )
const reg = require( "../../lib/reg.js" )

/*
  Assertions
*/

describe( "user.js", function() {

  it( "exports the user class", function() {

    user.name.should.equal( "user" )
    String( user ).slice( 0, 5 ).should.equal( "class" )

  } )

  describe( "user (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const u = new user( {}, {} )

      u.should.be.an.instanceof( user )

    } )

    describe( "constructor", function() {

      it( "sets the registrations property to an empty map", function() {

        const u = new user( {}, {} )

        u.registrations.should.be.an( "map" )
        u.registrations.size.should.equal( 0 )

      } )

      it( "sets the authorization property to the authorization parameter", function() {

        const authorization = { username: "some_username" }
        const u = new user( authorization, {} )

        u.authorization.should.equal( authorization )

      } )
    } )

    describe( "reg", function() {

      it( "returns if no registration is present under the call ID on the registrations property and the request registrar expires property is 0", function() {

        registrar = { options: {} }

        const u = new user( {}, registrar.options )

        const retVal = u.reg( Request.init( { registrar: { expires: 0 } } ), registrar ) // see Request.defaultValues for expires value

        should.equal( retVal, undefined )

      } )

      it( "lists a new registration under the call ID on the registrations property if not present and returns it if the request registrar expires property is not 0", function() {

        registrar = { options: {} }

        const u = new user( {}, registrar.options )

        u.reg( Request.init() ) // see Request.defaultValues for call-id and expires value

        const callid = Request.defaultValues.headers[ "call-id" ]
        const r = u.registrations.get( callid )

        u.registrations.has( callid ).should.equal( true )
        r.should.be.an.instanceof( reg )

        clearTimer( r )

      } )

      it( "calls the remove method passing the call ID and returns if a registration is listed under the call ID on the registrations property and the request registrar expires property is 0", function() {

        const registrar = { options: {} }

        const u = new user( {}, registrar.options )

        const callid = Request.defaultValues.headers[ "call-id" ]

        let hasPassed = false
        const intercept = ci => {
          if( ci == callid ) hasPassed = true
        }

        u.registrations.set( callid, new reg( Request.init(), u ) )
        u.remove = intercept

        const retVal = u.reg( Request.init( { registrar: { expires: 0 } } ) ) // see Request.defaultValues for call-id and expires value

        hasPassed.should.equal( true )
        should.equal( retVal, undefined )

      } )

      it( "updates a registration listed under the call ID on the registrations property, returns it and calls the registrar options consolelog method passing a status message if the request registrar expires property is not 0", function() {

        let message = ""
        const interceptConsolelog = msg => { message = msg }

        const authorization = { username: "some_username" }
        const registrar = {
          options: { consolelog: interceptConsolelog }
        }

        const u = new user( authorization, registrar.options )

        const callid = Request.defaultValues.headers[ "call-id" ]

        let hasCalled = false
        const interceptUpdate = () => { hasCalled = true }

        const r = new reg( Request.init(), u )
        r.update = interceptUpdate
        u.registrations.set( callid, r )

        const retVal = u.reg( Request.init(), registrar ) // see Request.defaultValues for call-id and expires value

        hasCalled.should.equal( true )
        message.should.equal( "1 registration(s) for user some_username" )
        retVal.should.equal( r )

        clearTimer( r )

      } )
    } )

    describe( "remove", function() {

      it( "calls the destroy method for a reg listed under the call ID on the registrations property and deletes the reg from the same", function() {

        const registrar = { options: {} }

        const u = new user( {}, registrar.options )

        const callid = Request.defaultValues.headers[ "call-id" ]

        let hasCalled = false
        const intercept = () => { hasCalled = true }

        const r = new reg( Request.init(), u )
        r.destroy = intercept
        u.registrations.set( callid, r )

        u.remove( callid )

        hasCalled.should.equal( true )
        u.registrations.has( callid ).should.equal( false )

        clearTimer( r )

      } )
    })
  } )
} )