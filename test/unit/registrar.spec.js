/*
  Dependencies
*/

const { EventEmitter } = require( "events" )

const should = require( "chai" ).should()

const Request = require( "../mock/request.js" )

const Registrar = require( "../../lib/registrar.js" )
const domain = require( "../../lib/domain.js" )

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

        registrar.domains.should.be.a( "map" )
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

        registrar.on( "some_event", data => {
          data.should.equal( "some_data" )
        } )

        em.emit( "some_event", "some_data" )

      } )
    } )

    describe( "reg", function() {

      it( "throws an error if the request registrar property is already set", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const invoke = () => { registrar.reg( Request.init(), {}, () => {} ) }

        should.Throw( invoke, "Registrar has been used twice" )

      } )

      it( "invokes the callback if the request method property is not \"REGISTER\"", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const req = Request.init( { method: "NOT_REGISTER" }, false ) // no registrar property

        let hasCalled = false
        registrar.reg( req, {}, () => { hasCalled = true } )

        hasCalled.should.equal( true )

      } )

      it( "calls the _isauthed method passing the host and username parsed from the request registration AOR property and the request", function() {

        const registrar = new Registrar( {
          srf: { use: () => {} },
          userlookup: () => new Promise( ( res, rej ) => {} )
        } )

        registrar._isauthed = ( host, username, request ) => {
          ( host === "some.realm" && username === "1000" && request === req ).should.equal( true )
        }

        const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

        registrar.reg( req, {}, () => {} )

      } )

      it( "calls the registration onexpire method passing the registration if the request registrar expires property is 0 and the registration is found", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar._isauthed = () => r

        const r = {
          onexpire: reg => {
           ( reg === r ).should.equal( true )
          },
          regping: () => {}
        }

        const req = Request.init( {
          registration: {
            aor: "sip:1000@some.realm",
            expires: 0
          }
        }, false ) // no registrar property

        registrar.reg( req, { send: () => {} }, () => {} )

      } )

      it( "calls the registration regping method if the registration is found", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar._isauthed = () => r

        let hasCalled = false
        const r = {
          onexpire: () => {},
          regping: () => { hasCalled = true }
        }

        const req = Request.init( {
          registration: {
            aor: "sip:1000@some.realm",
            expires: 0
          }
        }, false ) // no registrar property
        const res = { send: () => {} }

        registrar.reg( req, res, () => {} )

        hasCalled.should.equal( true );

      } )

      it( "calls the sendok function passing the request and response if the registration is found", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar._isauthed = () => r
        registrar._sendok = ( request, response ) => {
          ( request === req && response === res ).should.equal( true )
        }

        const r = { onexpire: () => {}, regping: () => {} }

        const req = Request.init( {
          registration: {
            aor: "sip:1000@some.realm",
            expires: 0
          }
        }, false ) // no registrar property
        const res = { send: () => {} }

        registrar.reg( req, res, () => {} )

      } )

      it( "calls the options consolelog method passing a message containing the URI parsed from the request \"To\" header if the registration is not found or registration expiring property is false", function() {

        const registrarInit = _isAuthedRetVal => {

          const registrar = new Registrar( {
            srf: { use: () => {} },
            userlookup: () => new Promise( ( res, rej ) => {} ),
          } )
          registrar._isauthed = () => _isAuthedRetVal
          registrar.options.consolelog = intercept

          return registrar
        }

        let interceptCount = 0
        const intercept = msg => msg === `Requesting auth for ${ AOR }` && interceptCount++

        const AOR = "sip:1000@some.realm"
        const res = { send: () => {} }

        // registrar1 - for no registration found
        const registrar1 = registrarInit( false )
        const req1 = Request.init( { registration: { aor: AOR } }, false ) // no registrar property
        registrar1.reg( req1, res, () => {} )

        // registrar2 - for registration found with registration expiring property false
        const r = {
          onexpire: () => {},
          regping: () => {},
          expiring: true
        }
        const registrar2 = registrarInit( r )
        const req2 = Request.init( { registration: { aor: AOR } }, false ) // no registrar property
        registrar2.reg( req2, res, () => {} )

        interceptCount.should.equal( 2 )

      } )

      it( "passes to the digest authentication function an options object containing a proxy property set to true, a password lookup function and a realm property set to the host parsed from the URI parsed in turn from the request \"To\" header, if the registration is not found or registration expiring property is false", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
        const res = {}

        const intercept = options => ( request, response, cb ) => {
          options.proxy.should.equal( true )
          options.passwordLookup.should.be.a( "function" )
          options.realm.should.equal( "some.realm" )
        }

        registrar.reg( req, res, () => {}, intercept )

      } )

      it( "passes to the challenge function the request, the response and a callback if the registration is not found or registration expiring property is false", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
        const res = {}

        const intercept = options => ( request, response, cb ) => {
          request.should.equal( req )
          response.should.equal( res )
          cb.should.be.a( "function" )
        }

        registrar.reg( req, res, () => {}, intercept )

      } )

      describe( "passwordLookup", function() {

        it( "calls the options userlookup method passing the username and realm parameters", function() {

          const registrar = new Registrar( {
            srf: { use: () => {} },
            userlookup: ( username, realm ) => {
              runShould( username, realm )
              return new Promise( ( res, rej ) => { res( "some_value" ) } )
            }
          } )

          const runShould = ( username, realm ) => {
            username.should.equal( "some_username" )
            realm.should.equal( "some.realm" )
          }

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

          const intercept = options => ( request, response, cb ) => {
            options.passwordLookup( "some_username", "some.realm", () => {} )
          }

          registrar.reg( req, {}, () => {}, intercept )

        } )

        it( "invokes the callback passing false and the user secret property in the options userlookup method success case", function() {

          const registrar = new Registrar( {
            srf: { use: () => {} },
            userlookup: ( username, realm ) => {
              return new Promise( ( res, rej ) => { res( { secret: "some_secret" } ) } )
            }
          } )

          const runShould = ( boolean, secret ) => {
            setTimeout( () => {
              boolean.should.equal( false )
              secret.should.equal( "some_secret" )
            }, 1 )
          }

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

          const intercept = options => ( request, response, cb ) => {
            options.passwordLookup( "some_username", "some.realm", runShould )
          }

          registrar.reg( req, {}, () => {}, intercept )

        } )

        it( "invokes the callback passing false and false in the options userlookup method failure case", function() {

          const registrar = new Registrar( {
            srf: { use: () => {} },
            userlookup: ( username, realm ) => {
              return new Promise( ( res, rej ) => { rej( "some_value" ) } )
            }
          } )

          const runShould = ( boolean, secret ) => {
            setTimeout( () => {
              boolean.should.equal( false )
              secret.should.equal( false )
            }, 1 )
          }

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

          const intercept = options => ( request, response, cb ) => {
            options.passwordLookup( "some_username", "some.realm", runShould )
          }

          registrar.reg( req, {}, () => {}, intercept )

        } )
      } )

      describe( "onauth", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
        const res = { send: () => {} }

        const intercept = options => ( request, response, cb ) => {

          const rR = request.registrar
          cb()

          const testValues = [

            { name: "contact", expected: "expires=1" },
            { name: "useragent", expected: "some_useragent" },
            { name: "allow", expected: "some_allow" },
            { name: "expires", expected: 1 }
          ]

          testValues.forEach( testValue => {

            it( `sets the request registrar ${ testValue.name } property`, function() {

              const discovered = rR[ testValue.name ]

              discovered.should.equal( testValue.expected )

            } )
          } )
        }

        registrar.reg( req, res, () => {}, intercept )

        it( "sets the allow property to the first request registration contact params methods property, replacing quotation marks, if present and if no request registrar allow property is present", function() {

          const registrar = new Registrar( { srf: { use: () => {} } } )

          const req = Request.init( {
            registration: { aor: "sip:1000@some.realm" },
            headers: { allow: undefined }
          }, false ) // no registrar property
          const res = { send: () => {} }

          const intercept = options => ( request, response, cb ) => {
            cb()
            request.registrar.allow.should.equal( "some_value" )
          }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "sets status to 423 and headers applying the request registrar contact and options minexpires properties if the options regping property is not present and the options minexpires property is present and greater than the request registrar expires property, which is not 0", function() {

          const registrar = new Registrar( { srf: { use: () => {} } } )

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: ( status, options ) => {
            status.should.equal( 423 )
            options.headers.Contact.should.equal( "expires=1" )
            options.headers[ "Min-Expires" ].should.equal( 3600 )
          } }

          const intercept = options => ( request, response, cb ) => { cb() }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "adds a domain named per the request authorization realm property to the domains property if not present", function() {

          const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: () => {} }

          const realm = Request.defaultValues.authorization.realm

          const intercept = options => ( request, response, cb ) => {
            cb()
            registrar.domains.get( realm ).should.be.an.instanceof( domain )
          }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "removes the domain named on the request authorization realm property if it has an empty users property", function() {

          const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

          const temp = domain.prototype.reg
          domain.prototype.reg = () => {} // prevents instantiation and addition in domain.reg

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: () => {} }

          const realm = Request.defaultValues.authorization.realm

          const intercept = options => ( request, response, cb ) => {
            cb()
            registrar.domains.has( realm ).should.equal( false )
            domain.prototype.reg = temp
          }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "calls the domain reg method passing the request", function() {

          const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

          const temp = domain.prototype.reg
          domain.prototype.reg = request => {
            request.should.be.an.instanceof( Request )
            domain.prototype.reg = temp
          }

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: () => {} }

          const intercept = options => ( request, response, cb ) => { cb() }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "calls the sendok function passing the request and response", function() {

          const registrar = new Registrar( { srf: { use: () => {} }, regping: () => {} } )

          registrar._sendok = ( request, response ) => {
            ( request === req && response === res ).should.equal( true )
          }

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: () => {} }

          const intercept = options => ( request, response, cb ) => { cb() }

          registrar.reg( req, res, () => {}, intercept )

        } )

        it( "emits the register event with the return value of the registration info method", function() {

          const em = new EventEmitter()

          const registrar = new Registrar( { em, srf: { use: () => {} }, regping: () => {} } )

          const dateOver1000Floored = parseInt( Math.floor( new Date() / 1000 ).toString() ) //.replace( /(\d*)\.\d*/g, "$1" ) )
          registrar.on( "register", data => {
            data.registeredat.should.equal( dateOver1000Floored )
          } )

          const req = Request.init( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property
          const res = { send: () => {} }

          const intercept = options => ( request, response, cb ) => { cb() }

          registrar.reg( req, res, () => {}, intercept )

        } )
      } )
    } )

    describe( "_isauthed", function() {

      it( "returns false if the realm passed is not present on the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar._isauthed( "some.realm", "some_user", {} ).should.equal( false )

      } )

      it( "returns false if the user passed is not present on the realm passed", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user1", {} )

        registrar._isauthed( "some.realm", "some_user2", {} ).should.eql( false )

      } )

      const baseR = {
        callid: "some_call-id",
        network: {
          source_address: "some_source_address",
          source_port: "some_source_port"
        }
      }

      const testValues = [
        { name: "source address", key: "source_address", mismatch: "some_other_source_address" },
        { name: "source port", key: "source_port", mismatch: "some_other_source_port" },
        { name: "call ID", key: "callid", mismatch: "some_other_call-id" }
      ]

      testValues.forEach( testValue => {

        it( `returns false if the request ${ testValue.name } does not match that on the network property of the registration corresponding to the call ID`, function() {

          const registrar = new Registrar( { srf: { use: () => {} } } )

          const u = { registrations: new Map() }
          const r = JSON.parse( JSON.stringify( baseR ) )

          testValue.key.includes( "source_" )
            ? ( r.network[ testValue.key ] = testValue.mismatch )
            : ( r[ testValue.key ] = testValue.mismatch )

          u.registrations.set( "some_call-id", r )

          registrar.domains.set( "some.realm", { users: new Map() } )
          registrar.domains.get( "some.realm" ).users.set( "some_user", u )

          const retVal = registrar._isauthed( "some.realm", "some_user", Request.init() ) // see Request.defaultValues for source_address, source_port and call-id value

          retVal.should.equal( false )

        } )
      } )

      it( "returns the registration corresponding to the call ID if the request source address, source port and call ID match those on the registration network property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }
        const r = JSON.parse( JSON.stringify( baseR ) )

        u.registrations.set( "some_call-id", r )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user", u )

        const retVal = registrar._isauthed( "some.realm", "some_user", Request.init() ) // see Request.defaultValues for source_address, source_port and call-id value

        retVal.should.equal( r )

      } )
    } )

    describe( "_sendok", function() {

      it( "sets status to 200 and headers applying the regping option if present", function() {

        const registrar = new Registrar( {
          srf: { use: () => {} },
          regping: 2
        } )

        const intercept = ( status, options ) => {
            status.should.equal( 200 )
            options.headers.Contact.should.equal( "expires=2" )
            options.headers.Expires.should.equal( 2 )
        }

        registrar._sendok( Request.init(), { send: intercept }, registrar.options ) // 1

      } )

      it( "sets status to 200 and headers applying request registrar properties if regping option not present", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const intercept = ( status, options ) => {
          status.should.equal( 200 )
          options.headers.Contact.should.equal( "expires=1" )
          options.headers.Expires.should.equal( 1 )
        }

        registrar._sendok( Request.init(), { send: intercept }, registrar.options )

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

    describe( "users", function() {

      it( "returns an empty array if the key passed is not present on the domains property", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.users( "some.domain" ).should.eql( [] )

      } )

      it( "calls the domain info method, returning the result, for a value on the domains property corresponding to the key passed if present", function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some.domain", { info: () => [ "some_info" ] } )

        registrar.users( "some.domain" ).should.eql( [ "some_info" ] )

      } )
    } )

    describe( "user", function() {

      it( "parses the host and username from the realm if username not passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }
        const r = { info: () => "some_info" }

        u.registrations.set( "some_call-id", r )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "1000", u )

        const ua = await registrar.user( "sip:1000@some.realm" )

        ua[ 0 ].should.equal( "some_info" )

      } )

      it( "returns an empty array if the realm passed is not present on the domains property", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const result = await registrar.user( "some.realm", "some_user" )

        result.should.eql( [] )

      } )

      it( "returns an empty array if the username passed is not present on the realm passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user1", {} )

        const result = await registrar.user( "some.realm", "some_user2" )

        result.should.eql( [] )

      } )

      it( "returns an array containing info for each registration for the username passed at the realm passed", async function() {

        const registrar = new Registrar( { srf: { use: () => {} } } )

        const u = { registrations: new Map() }

        const r1 = { info: () => "some_info1" }
        const r2 = { info: () => "some_info2" }

        u.registrations.set( "some_call-id1", r1 )
        u.registrations.set( "some_call-id2", r2 )

        registrar.domains.set( "some.realm", { users: new Map() } )
        registrar.domains.get( "some.realm" ).users.set( "some_user", u )

        const ua = await registrar.user( "some.realm", "some_user" )

        ua[ 0 ].should.equal( "some_info1" )
        ua[ 1 ].should.equal( "some_info2" )

      } )
    } )
  } )
} )
