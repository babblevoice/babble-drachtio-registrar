
const should = require( "chai" ).should()


describe( "index.js", function() {

  it( "exports the Registrar class", function() {

    const registrar = require( "../../lib/index.js" )

    registrar.name.should.equal( "Registrar" )

  } )
} )
