/*
  Dependencies
*/

const { EventEmitter } = require( "events" )
const uuid = require( "uuid" )

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const { clearTimer } = require( "../util/cleanup.js" )

const reg = require( "../../lib/reg.js" )

/*
  Assertions
*/

describe( "reg.js", function() {

  it( "exports the reg class", function() {

    reg.name.should.equal( "reg" )
    String( reg ).slice( 0, 5 ).should.equal( "class" )

  } )

  describe( "reg (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const registrar = { options: {} }
      const u = { authorization: {}, options: registrar.options }

      const r = new reg( Request.init(), u )

      r.should.be.an.instanceof( reg )

      clearTimer( r )

    } )

    describe( "constructor", function() {

      const registrar = { options: { divisor: 1000 } }
      const u = { authorization: { username: "some_user" }, options: registrar.options }

      const r = new reg( Request.init(), u )

      const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )

      const testValues = [

        { name: "uuid", calculated: uuid.validate( r.uuid ), expected: true },
        { name: "initial", expected: true },
        { name: "network", calculated: JSON.stringify( r.network ), expected: "{\"source_address\":\"some_source_address\",\"source_port\":\"some_source_port\",\"protocol\":\"some_protocol\"}" },
        { name: "useragent", expected: "some_useragent" },
        { name: "allow", calculated: JSON.stringify( r.allow ), expected: "[\"SOME\",\"_\",\"ALLOW\"]" },
        { name: "callid", expected: "some_call-id" },
        { name: "contact", calculated: JSON.stringify( r.contact ), expected: "[{\"uri\":\"some_uri\"},{\"uri\":\"some_uri\"}]" },
        { name: "aor", expected: "some_aor" },
        { name: "expires", expected: 1 },
        { name: "user", expected: u },
        { name: "authorization", calculated: JSON.stringify( r.authorization ), expected: "{\"username\":\"some_user\"}" },
        { name: "options", calculated: JSON.stringify( r.options ), expected: "{\"divisor\":1000}" },
        { name: "registeredat", expected: dateOver1000Floored },
        { name: "ping", expected: dateOver1000Floored },
        { name: "regexpiretimer", calculated: `${ r.regexpiretimer._onTimeout.name }, ${ r.regexpiretimer._idleTimeout }`, expected: "onexpire, 1000" }
      ]

      testValues.forEach( testValue => {

        it( `sets the ${ testValue.name } property`, function() {

          const discovered = testValue.calculated || r[ testValue.name ]

          discovered.should.equal( testValue.expected )

        } )
      } )

      clearTimer( r )

      it( "sets the expires property to the user options expires option if present", function() {

        const registrar = { options: { regping: () => {}, expires: 2 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u ) // 1

        r.expires.should.equal( 2 )

        clearTimer( r )

      } )
    } )

    describe( "get expired", function() {

      it( "returns a boolean value for expiry elapsed", function() {

        const expires = 2

        const registrar = { options: { regping: () => {}, expires } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u ) // 1

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const registeredat = dateOver1000Floored
        const total = registeredat + expires

        const hasExpired = total < dateOver1000Floored

        r.expired.should.be.a( "boolean" )
        r.expired.should.equal( hasExpired )

        clearTimer( r )

      })
    } )

    describe( "get expiring", function() {

      it( "returns a boolean value for expiry approaching", function() {

        const expires = 2

        const registrar = { options: { regping: () => {}, expires } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u ) // 1

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const registeredat = dateOver1000Floored
        const total = registeredat + ( expires / 2 )

        const isExpiring = total < dateOver1000Floored

        r.expiring.should.be.a( "boolean" )
        r.expiring.should.equal( isExpiring )

        clearTimer( r )

      })
    } )

    describe( "info", function() {

      it( "returns the contact URIs mapped to an array", function() {

        const registrar = { options: {} }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u ) // see Request.defaultValues for contact value

        r.info().contacts.should.eql( [ "some_uri", "some_uri" ] ) // eql for deep equality

        clearTimer( r )

      } )

      it( "returns the uuid, initial, callid, aor, expires, authorization, registeredat, useragent, allow and network properties", function() {

        const registrar = { options: { divisor: 1000 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const testValues = [ "uuid", "initial", "callid", "aor", "expires", "authorization", "registeredat", "useragent", "allow", "network" ]

        testValues.forEach( testValue => {

          r.info()[ testValue ].should.equal( r[ testValue ] )

        } )

        clearTimer( r )

      } )

      it( "returns an expiresat property being the sum of the registeredat and expires properties", function() {

        const registrar = { options: { divisor: 1000 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const expiresat = dateOver1000Floored + 1 // per Request.defaultValues

        r.info().expiresat.should.equal( expiresat )

        clearTimer( r )

      } )

      it( "returns an expiresin property being the sum of the registeredat and expires properties minus the current JavaScript date in seconds rounded down", function() {

        const registrar = { options: { divisor: 1000 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const expiresin = dateOver1000Floored + 1 - dateOver1000Floored // see Request.defaultValues for expires value

        r.info().expiresin.should.equal( expiresin )

        clearTimer( r )

      } )

      it( "returns a stale property being a boolean generated with the ping and registrar options staletime properties", function() {

        const registrar = { options: { staletime: 1 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const stale = dateOver1000Floored < dateOver1000Floored - 1 // ping is JavaScript date in seconds rounded down

        r.info().stale.should.be.a( "boolean" )
        r.info().stale.should.equal( stale )

        clearTimer( r )

      } )
    } )

    describe( "destroy", function() {

      it( "resets the regexpiretimer property", function() {

        const registrar = { options: {} }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const regexpiretimer = r.regexpiretimer

        r.update()

        r.regexpiretimer.should.not.equal( regexpiretimer )

        clearTimer( r )

      } )

      it( "resets the registeredat property", function() {

        const registrar = { options: { divisor: 1000 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )

        r.update()

        r.registeredat.should.equal( dateOver1000Floored )

        clearTimer( r )

      } )

      it( "sets the initial property to false", function() {

        const registrar = { options: {} }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        r.update()

        r.initial.should.equal( false )

        clearTimer( r )

      } )
    } )

    describe( "regping", function() {

      it( "resets the ping property", function( done ) {

        const registrar = { options: {} }
        const u = {
          authorization: {},
          options: registrar.options,
          remove: () => {}
        }
        const r = new reg( Request.init(), u )

        const ping = r.ping

        const runShould = () => { r.ping.should.not.equal( ping ) }

        let hasAsserted = false // all active timeouts will call intercept, with second call to done throwing error

        const intercept = () => {
          if( !hasAsserted ) {
            hasAsserted = true; r.regping(); runShould(); clearTimer( r ); done()
          }
        }

        setTimeout( intercept, 1000 )

      } )
    } )

    describe( "onexpire", function() {

      it( "calls the user property remove method passing the instance as an argument", function( done ) {

        const registrar = { options: {} }

        const runShould = function( ci ) { ci.should.equal( r.callid ) }

        let hasAsserted = false // all active timeouts will call intercept, with second call to done throwing error

        const u = {
          authorization: {},
          options: registrar.options,
          remove: ci => {
            if( !hasAsserted ) {
              hasAsserted = true; runShould( ci ); clearTimer( r ); done()
            }
          }
        }
        const r = new reg( Request.init(), u )

        r.onexpire( r )

        clearTimer( r )

      } )
    } )

    describe( "destroy", function() {

      it( "emits the unregister event with the info method", function( done ) {

        const em = new EventEmitter()

        const registrar = { options: { em } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        em.on( "unregister", function( info ) {
          info.should.eql( r.info() ) // eql for deep equality
          done()
        } )

        r.destroy()

      } )

      it( "clears the optionsintervaltimer property", function() {

        const registrar = { options: { em: { emit: () => {} }, optionsping: 1 } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        r.destroy()

        r.optionsintervaltimer._destroyed.should.equal( true )

      } )

      it( "clears the regexpiretimer property", function() {

        const registrar = { options: { em: { emit: () => {} } } }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        r.destroy()

        r.regexpiretimer._destroyed.should.equal( true )

      } )
    } )

    describe( "pingoptions", function() {

      it( "calls the SRF request method for each contact passing the URI, an object with the correct request method and subject header and a callback", function( done ) {

        const runShould = ( uri, obj, cb ) => {
          uri.should.equal( "some_uri" )
          obj.method.should.equal( "OPTIONS" )
          obj.headers.should.eql( { Subject: "OPTIONS Ping" } ) // eql for deep equality
          cb.should.be.a( "function" )
        }

        let hasAsserted = false // intercept will be called for both URIs, with second call to done throwing error

        const intercept = ( uri, obj, cb) => {
          if( !hasAsserted ) {
            hasAsserted = true; runShould( uri, obj, cb ); clearTimer( r ); done()
          }
        }

        const registrar = {
          options: {
            srf: {
              request: ( uri, obj, cb ) => {
                intercept( uri, obj, cb )
              }
            }
          }
        }
        const u = { authorization: {}, options: registrar.options }

        const r = new reg( Request.init(), u )

        r.pingoptions( { contact: [ { uri: "some_uri" }, { uri: "some_uri" } ] } )

        clearTimer( r )

      } )

      describe( "SRF request method callback", function() {

        it( "calls the registrar options consolelog method passing an error message on SRF request error", function( done ) {

          const runShould = msg2 => { msg2.should.equal( "Error sending OPTIONS: msg1" ) }

          const registrar = {
            options: {
              srf: {
                request: ( uri, obj, cb ) => {
                  cb( "msg1" )
                }
              },
              consolelog: msg2 => {
                runShould( msg2 ); clearTimer( r ); done()
              }
            }
          }
          const u = { authorization: {}, options: registrar.options }
          const r = new reg( Request.init(), u )

          r.pingoptions( { contact: [ { uri: "some_uri" } ] } )

          clearTimer( r )

        } )

        it( "sets the ping property on SRF request success to the current JavaScript date in seconds rounding down", function( done ) {

          const em = new EventEmitter()

          const registrar = {
            options: {
              divisor: 1000,
              srf: {
                request: ( uri, obj, cb ) => {
                  cb( null, em )
                  em.emit( "response", { status: 200 } )
                }
              }
            }
          }
          const u = { authorization: { username: "some_user" }, options: registrar.options }

          const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )

          em.on( "response", function( res ) {
            r.ping.should.equal( dateOver1000Floored )
            done()
          } )

          const r = new reg( Request.init(), u )

          r.pingoptions( { contact: [ { uri: "some_uri" } ] } )

          clearTimer( r )

        } )
      } )
    } )
  } )
} )
