/*
  Dependencies
*/

const { EventEmitter } = require( "events" )

const should = require( "chai" ).should()

const Registrar = require( "../../lib/registrar.js" )

/*
  Assertions
*/

describe( "registrar.js", function() {

  it( "exports the Registrar class", function() {

    Registrar.name.should.equal( "Registrar" )
    String( Registrar ).slice( 0, 5 ).should.equal( "class" )

  } )

  describe( "Registrar (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const registrar = new Registrar( { srf: { use: () => {} } } )

      registrar.should.be.an.instanceof( Registrar )

    } )

    describe( "constructor", function() {

      it( "sets the options property to a merger of defaults and options passed", function() {

        const em = new EventEmitter()

        const registrar = new Registrar( { debug: true, em, srf: { use: () => {} } } )

        const options = {
          expires: 3600,
          minexpires: 3600,
          staletime: 300,
          debug: true,
          em,
          srf: { use: () => {} }
        }

        JSON.stringify( registrar.options ).should.equal( JSON.stringify( options ) )

      } )

      it( "sets the domains property to an empty map", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.should.be.an( "map" )
        registrar.domains.size.should.equal( 0 )

      } )

      it( "calls the options SRF use method passing \"register\" and regparser then \"register\" and Registrar.reg", function() {

        const regparser = () => {}

        let hasAsserted = false

        const intercept = ( event, fn ) => {
          event.should.equal( "register" )
          !hasAsserted
            ? fn.should.equal( regparser ) && ( hasAsserted = true )
            : fn.should.equal( Registrar.prototype.reg )
        }

        const registrar = new Registrar( { srf: { use: intercept } }, regparser )

      } )

      it( "sets the options em property if not set on options passed", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const em = new EventEmitter()

        registrar.options.em.should.eql( em )

      } )

      it( "sets the consolelog method to log to the console \"Registrar: \" plus a message passed if the default options debug value is overridden", function() {

        const registrar = new Registrar( { debug: true, srf: { use: () => {} } } )

        registrar.options.consolelog.toString().should.include( "m => {" )
        registrar.options.consolelog.toString().should.include( "console.log( \"Registrar: \" + m )" )

      } )

      it( "sets the consolelog method to an empty function if the default options debug value is not overridden", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.options.consolelog.toString().should.equal( "m => {}" )

      } )
    } )

    describe( "on", function() {

      it( "sets an event listener for an event and a callback passed", function() {

        const em = new EventEmitter()

        const registrar = new Registrar( { em, srf: { use: () => {} } } )

        const intercept = data => {
          data.should.equal( "some_data" )
        }

        registrar.on( "some_event", intercept )

        em.emit( "some_event", "some_data" )

      } )
    } )

    describe( "realms", function() {

      it( "returns an array containing the keys of the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some_key1", "some_value1" )
        registrar.domains.set( "some_key2", "some_value2" )

        registrar.realms().should.eql( [ "some_key1", "some_key2" ] )

      } )
    } )
  } )
} )
