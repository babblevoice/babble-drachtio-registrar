/*
  Dependencies
*/

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )
const user = require( "../mock/user.js" )
const reg = require( "../mock/reg.js" )

const domain = require( "../../lib/domain.js" )

/*
  Assertions
*/

describe( "domain.js", function() {

  it( "exports the domain class", function() {

    domain.name.should.equal( "domain" )
  
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

        d.reg( Request.init(), user ) // see Request.defaultValues for username value

        d.users.has( Request.defaultValues.authorization.username ).should.equal( true )
        d.users.get( Request.defaultValues.authorization.username ).should.be.an.instanceof( user )

      } )

      it( "removes the user named on the request authorization username property if it has an empty registrations property", function() {

        const d = new domain()

        d.reg( Request.init(), user.init() && user ) // see Request.defaultValues for username value

        d.users.has( Request.defaultValues.authorization.username ).should.equal( false )

      } )

      it( "calls the user reg method passing the request", function() {

        const d = new domain()

        user.init( { reg: req => req instanceof Request } )

        d.reg( Request.init(), user ).should.equal( true )

      } )

      it( "returns undefined if the request registrar expires property is 0", function() {

        const d = new domain()

        user.init( { reg: req => { if( 0 === req.registrar.expires ) return } } )

        const retVal = d.reg( Request.init( { registrar: {
          useragent: "some_useragent",
          allow: "some _,allow", // babble-drachtio-registrar reg class constructor splits on \s or ,
          expires: 1
        } } ), user )

        should.equal( retVal, undefined )

      } )

      it( "returns a reg instance if the request registrar expires property is not 0", function() {

        const d = new domain()

        user.init( { reg: req => 0 != req.registrar.expires && reg.init() } )

        d.reg( Request.init(), user ).should.be.an.instanceof( reg )

      } )
    } )
  } )
} )  