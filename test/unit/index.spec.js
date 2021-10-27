/*
  Dependencies
*/

const should = require( "chai" ).should()

/*
  Assertions
*/

describe( "index.js", function() {

  it( "exports the Registrar class", function() {

    const registrar = require( "../../index.js" )

    registrar.name.should.equal( "Registrar" )
    String( registrar ).slice( 0, 5 ).should.equal( "class" )

  } )
} )
