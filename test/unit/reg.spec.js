
const should = require( "chai" ).should()
const uuid = require( "uuid" )

const Request = require( "../mock/request.js" )
const user = require( "../mock/user.js" )

/* Initialize singleton */
const { setSingleton } = require( "../../lib/singleton.js" )
setSingleton( { options: { regping: undefined, srf: { use: () => {} } } } )

const reg = require( "../../lib/reg.js" )


describe( "reg.js", function() {

  it( "exports the reg class", function() {

    reg.name.should.equal( "reg" )

  } )

  describe( "reg (class)", function() {

    it( "returns an instance of itself when called with the new keyword", function() {

      const r = new reg( Request.init(), user.init() )

      r.should.be.an.instanceof( reg )

    } )

    describe( "constructor", function() {

      const someUser = user.init()
      const r = new reg( Request.init( { get: header => "some_" + header } ), someUser )

      const dateOver1000Floored = parseInt( ( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )

      const testValues = [

        { name: "uuid", calculated: uuid.validate( r.uuid ), expected: true },
        { name: "initial", expected: true },
        { name: "network", calculated: JSON.stringify( r.network ), expected: "{\"source_address\":\"some_source_address\",\"source_port\":\"some_source_port\",\"protocol\":\"some_protocol\"}" },
        { name: "useragent", expected: "some_useragent" },
        { name: "allow", calculated: JSON.stringify( r.allow ), expected: "[\"SOME\",\"_\",\"ALLOW\"]" },
        { name: "callid", expected: "some_call-id" },
        { name: "contact", expected: "some_contact" },
        { name: "aor", expected: "some_aor" },
        { name: "expires", expected: 1 },
        { name: "authorization", expected: "some_authorization" },
        { name: "user", expected: someUser },
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
    } )

      it( "sets the expires property to the singleton expires option if present", function() {

        setSingleton( { options: { regping: () => {}, expires: 2 } } )

        const r = new reg( Request.init(), user.init() ) // 1

        r.expires.should.equal( 2 )

      } )

    describe( "get expired", function() {

      it( "returns boolean for expiry elapsed", function() {

        const expires = 2

        setSingleton( { options: { regping: () => {}, expires } } )

        const r = new reg( Request.init(), user.init() ) // 1

        const dateOver1000Floored = parseInt( ( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const registeredat = dateOver1000Floored
        const total = registeredat + expires

        const hasExpired = total < dateOver1000Floored

        r.expired.should.equal( hasExpired )
      })
    } )

    describe( "get expiring", function() {

      it( "returns boolean for expiry approaching", function() {

        const expires = 2

        setSingleton( { options: { regping: () => {}, expires } } )

        const r = new reg( Request.init(), user.init() ) // 1

        const dateOver1000Floored = parseInt( ( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
        const registeredat = dateOver1000Floored
        const total = registeredat + ( expires / 2 )

        const isExpiring = total < dateOver1000Floored

        r.expired.should.equal( isExpiring )
      })
    } )
  } )
} )
