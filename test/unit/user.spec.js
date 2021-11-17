
const should = require( "chai" ).should()
const expect = require( "chai" ).expect

const reg = require( "../mock/reg.js" )

const user = require( "../../lib/user.js" )

describe( "user.js", function() {

  it( "exports the user class", function() {

    user.name.should.equal( "user" )
    String( user ).slice( 0, 5 ).should.equal( "class" )

  } )

  it( "returns an instance of itself when called with the new keyword", function() {
    const u = new user()
    u.should.be.an.instanceof( user )
  } )

  it( "returns an instance of itself when called with the create function", function() {
    const u = user.create()
    u.should.be.an.instanceof( user )
  } )

  it( "sets the registrations property to an empty map", function() {
    const u = user.create()
    u._registrations.should.be.a( "map" )
    u._registrations.size.should.equal( 0 )
  } )

  it( "add some registrations", function() {

    const u = user.create()

    const r = reg.create()
    const r2 = reg.create()

    u.set( r )
    u.set( r2 )

    expect( u._registrations.size ).to.equal( 2 )

    u.delete( r )

    /* nothing bad should happen */
    u.delete( r )

    expect( u._registrations.size ).to.equal( 1 )

    u.delete( r2 )
    expect( u._registrations.size ).to.equal( 0 )

  } )
} )
