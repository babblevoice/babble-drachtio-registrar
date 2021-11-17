
const should = require( "chai" ).should()
const expect = require( "chai" ).expect

const reg = require( "../mock/reg.js" )
const domain = require( "../../lib/domain.js" )

describe( "domain.js", function() {

  it( "sets the users property to an empty map", function() {
    const d = domain.create()
    d._users.should.be.a( "map" )
    d._users.size.should.equal( 0 )
  } )

  it( "returns an instance of itself when called with the new keyword", function() {
    const d = domain.create()
    d.should.be.an.instanceof( domain )
  } )

  it( "add 2 users to 1 domain", function() {
    const d = domain.create()

    const r = reg.create()
    const r2 = reg.create()

    d.set( r )
    d.set( r2 )

    expect( d.get( "bob" ) ).to.be.a( "array" ).to.have.lengthOf( 2 )
  } )
} )
