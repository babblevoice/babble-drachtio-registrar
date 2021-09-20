/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )
const user = require( "../mock/user.js" )

const domain = require( "../../lib/domain.js" )
const reg = require( "../../lib/reg.js" )
const { getSingleton } = require("../../lib/singleton.js")

/*
  Assertions
*/

describe( "domain.js", function() {

  it( "exports the domain class", function() {

    domain.name.should.equal( "domain" )
    String( domain ).slice( 0, 5 ).should.equal( "class" )

  } )
  
  describe( "domain (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const d = new domain()

      d.should.be.an.instanceof( domain )

    } )

    describe( "constructor", function() {

      it( "sets the users property to an empty map", function() {

        const d = new domain()

        d.users.should.be.an( "map" )
        d.users.size.should.equal( 0 )

      } )
    } )

    describe( "reg", function() {

      it( "adds a user named per the request authorization username property to the users property if not present", function() {

        const d = new domain()

        user.init( { reg: function() { this.registrations.set( "some_callid", {} ) } } ) // prevents immediate deletion in domain.reg

        d.reg( Request.init(), {}, user ) // see Request.defaultValues for username value

        const username = Request.defaultValues.authorization.username

        d.users.has( username ).should.equal( true )
        d.users.get( username ).should.be.an.instanceof( user )

      } )

      it( "removes the user named on the request authorization username property if it has an empty registrations property", function() {

        const d = new domain()

        d.reg( Request.init(), {}, user.init() && user ) // see Request.defaultValues for username value

        const username = Request.defaultValues.authorization.username

        d.users.has( username ).should.equal( false )

      } )

      it( "calls the user reg method passing the request and the singleton", function() {

        const d = new domain()

        user.init( { reg: ( req, singleton ) => req instanceof Request && singleton === getSingleton() } )

        d.reg( Request.init(), getSingleton(), user ).should.equal( true )

      } )

      it( "returns undefined if the request registrar expires property is 0", function() {

        const d = new domain()

        user.init( { reg: req => { if( 0 === req.registrar.expires ) return } } )

        const retVal = d.reg( Request.init(), {}, user )

        should.equal( retVal, undefined )

      } )

      it( "returns a reg instance if the request registrar expires property is not 0", function() {

        const d = new domain()

        user.init( { reg: req => 0 != req.registrar.expires && new reg( Request.init(), user.init(), getSingleton() ) } )

        d.reg( Request.init(), {}, user ).should.be.an.instanceof( reg )

      } )
    } )

    describe( "getinfo", function() {

      it( "returns an array containing info for each registration for each user on the users property", function() {

        const d = new domain()

        //const getinfo = function() { return { some_key: "some_value" } }

        const u1 = user.init()
        const r1 = new reg( Request.init(), user.init(), getSingleton() )

        const u2 = user.init()
        const r2 = new reg( Request.init(), user.init(), getSingleton() )

        u1.registrations.set( "some_call-id1", r1 )
        d.users.set( "some_username1", u1 )

        u2.registrations.set( "some_call-id2", r2 )
        d.users.set( "some_username2", u2 )

        const ua = d.getinfo( getSingleton().options )

        ua.should.be.an( "array" )
        ua[ 0 ].should.eql( r1.getinfo( getSingleton().options ) ) // eql for deep equality
        ua[ 1 ].should.eql( r2.getinfo( getSingleton().options ) )

      } )
    } )
  } )
} )  