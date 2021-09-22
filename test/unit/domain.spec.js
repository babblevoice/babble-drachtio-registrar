/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const { clearTimer } = require( "../util/cleanup.js" )

const domain = require( "../../lib/domain.js" )
const user = require( "../../lib/user.js" )
const reg = require( "../../lib/reg.js" )

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

        registrar = { options: {} }

        const temp = user.prototype.reg
        user.prototype.reg = function() { // prevents deletion in domain.reg
          this.registrations.set( "some_callid", {} )
        }

        d.reg( Request.init(), registrar ) // see Request.defaultValues for username value

        const username = Request.defaultValues.authorization.username

        d.users.has( username ).should.equal( true )
        d.users.get( username ).should.be.an.instanceof( user )

        user.prototype.reg = temp

      } )

      it( "removes the user named on the request authorization username property if it has an empty registrations property", function() {

        const d = new domain()

        registrar = { options: {} }

        const temp = user.prototype.reg
        user.prototype.reg = () => {} // prevents instantiation and addition in user.reg

        d.reg( Request.init(), registrar ) // see Request.defaultValues for username value

        const username = Request.defaultValues.authorization.username

        d.users.has( username ).should.equal( false )

        user.prototype.reg = temp

      } )

      it( "calls the user reg method passing the request and the registrar", function() {

        const d = new domain()

        registrar = { options: {} }

        const temp = user.prototype.reg
        user.prototype.reg = ( req, reg ) => req instanceof Request && reg === registrar

        d.reg( Request.init(), registrar ).should.equal( true )

        user.prototype.reg = temp

      } )

      it( "returns undefined if the request registrar expires property is 0", function() {

        const d = new domain()

        registrar = { options: {} }

        const temp = user.prototype.reg
        user.prototype.reg = req => {
          if( 0 === req.registrar.expires ) return
        }

        const retVal = d.reg( Request.init(), registrar )

        should.equal( retVal, undefined )

        user.prototype.reg = temp

      } )

      it( "returns a reg instance if the request registrar expires property is not 0", function() {

        const d = new domain()

        registrar = { options: {} }

        const temp = user.prototype.reg
        const r = new reg( Request.init(), {}, registrar )
        user.prototype.reg = req => {
          if( 0 != req.registrar.expires ) return r
        }

        d.reg( Request.init(), registrar ).should.be.an.instanceof( reg )

        user.prototype.reg = temp
        clearTimer( r )

      } )
    } )

    describe( "info", function() {

      it( "returns an array containing info for each registration for each user on the users property", function() {

        const d = new domain()

        registrar = { options: {} }

        const u1 = { registrations: new Map() }
        const r1 = new reg( Request.init(), u1, registrar )

        const u2 = { registrations: new Map() }
        const r2 = new reg( Request.init(), u2, registrar )

        u1.registrations.set( "some_call-id1", r1 )
        d.users.set( "some_username1", u1 )

        u2.registrations.set( "some_call-id2", r2 )
        d.users.set( "some_username2", u2 )

        const ua = d.info( registrar.options )

        ua.should.be.an( "array" )
        ua[ 0 ].should.eql( r1.info( registrar.options ) ) // eql for deep equality
        ua[ 1 ].should.eql( r2.info( registrar.options ) )

        clearTimer( r1 )
        clearTimer( r2 )

      } )
    } )
  } )
} )
