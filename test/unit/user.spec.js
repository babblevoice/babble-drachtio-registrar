/*
  Dependencies
*/

const should = require( "chai" ).should()

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

      const u = new user( {} )

      u.should.be.an.instanceof( user )

    } )

    describe( "constructor", function() {

      it( "sets the registrations property to an empty map", function() {

        const u = new user( {} )

        u.registrations.should.be.an( "map" )
        u.registrations.size.should.equal( 0 )

      } )

      it( "sets the authorization property to the authorization parameter", function() {

        const authorization = { username: "some_username" }
        const u = new user( authorization )

        u.authorization.should.equal( authorization )

      } )
    } )

    describe( "reg", function() {
      
    } )
  } )
} )