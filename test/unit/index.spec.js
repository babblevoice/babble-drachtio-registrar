
const registrar = require( "../../index.js" )


describe( "index.js", function() {

  it( "exports the Registrar class", function() {

    registrar.name.should.equal( "Registrar" )
    String( registrar ).slice( 0, 5 ).should.equal( "class" )

  } )
} )
