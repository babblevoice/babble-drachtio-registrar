
const calculateauth = require( "../util/auth.js" ).calculateauth

const should = require( "chai" ).should()
const expect = require( "chai" ).expect

const events = require( "events" )

const store = require( "../../lib/store.js" )
const Request = require( "../mock/request.js" )

const Registrar = require( "../../index.js" )


describe( "interface", function() {
  it( `register, auth, event then check store`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-----reg ( expires 3600 w-auth)-->|(3)
    |<--------200 ok-------------------|(4)
    */
    let ourevents = []
    let cb
    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter()
    }
    const registrar = new Registrar( options )

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    cb( req, res )

    let reginfo = await regevent

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 3600 )

    expect( reginfo ).to.be.a( "object" )
    expect( reginfo.uuid ).to.be.a( "string" )
    expect( reginfo.initial ).to.be.a( "boolean" ).to.be.true
    expect( reginfo.callid ).to.be.a( "string" ).to.equal( "some_call-id" )
    expect( reginfo.contacts ).to.be.a( "array" )
    expect( reginfo.contacts ).to.be.a( "array" ).to.have.lengthOf( 1 )
    expect( reginfo.contacts[ 0 ] ).to.be.a( "string" )
    expect( reginfo.auth ).to.be.a( "object" )
    expect( reginfo.auth.username ).to.be.a( "string" ).to.equal( "bob" )
    expect( reginfo.auth.realm ).to.be.a( "string" ).to.equal( "dummy.com" )
    expect( reginfo.auth.uri ).to.be.a( "string" ).to.equal( "bob@dummy.com" )
    expect( reginfo.auth.display ).to.be.a( "string" ).to.equal( "Kermit Frog" )
    expect( reginfo.expires ).to.be.a( "number" ).to.equal( 3600 )
    expect( reginfo.registeredat ).to.be.a( "number" )
    expect( reginfo.expiresat ).to.be.a( "number" )
    expect( reginfo.expiresin ).to.be.a( "number" ).to.equal( 3600 )
    expect( reginfo.stale ).to.be.a( "boolean" ).to.be.false
    expect( reginfo.network ).to.be.a( "object" )
    expect( reginfo.network.source_address ).to.be.a( "string" ).to.equal( "some_source_address" )
    expect( reginfo.network.source_port ).to.be.a( "number" ).to.equal( 5060 )
    expect( reginfo.network.protocol ).to.be.a( "string" ).to.equal( "some_protocol" )


    let user = await registrar.user( "dummy.com", "bob" )
    expect( user ).to.be.a( "array" ).to.have.lengthOf( 1 )

    user = await registrar.user( "bob@dummy.com" )
    expect( user ).to.be.a( "array" ).to.have.lengthOf( 1 )

    let domain = await registrar.users( "dummy.com" )

    expect( domain ).to.be.a( "array" ).to.have.lengthOf( 1 )

    store.get( req ).destroy()

    domain = await registrar.users( "dummy.com" )

    expect( domain ).to.be.a( "array" ).to.have.lengthOf( 0 )
  } )

  it( `register, auth then wait for stale and check flag`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-----reg ( expires 3600 w-auth)-->|(3)
    |<--------200 ok-------------------|(4)
    Wait - is stale flag set
    */
    let ourevents = []
    let cb
    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      staletime: 0
    }
    const registrar = new Registrar( options )

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    debugger
    cb( req, res )

    let reginfo = await regevent

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 3600 )

    expect( reginfo.stale ).to.be.a( "boolean" ).to.be.false

    await new Promise( ( r ) => { setTimeout( () => r(), 1100 ) } )

    let r = store.get( req )
    reginfo = r.info()
    expect( reginfo.stale ).to.be.a( "boolean" ).to.be.true

    expect( r ).to.be.a( "object" )
    r.destroy()
  } )

  it( `register, auth then wait for expires and check cleaned up`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-----reg ( expires 3600 w-auth)-->|(3)
    |<--------200 ok-------------------|(4)
    Wait - until expires
    */
    let ourevents = []
    let cb
    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      minexpires: 1
    }

    const registrar = new Registrar( options )

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    let unregevent = new Promise( ( resolve ) => {
      options.em.on( "unregister", ( i ) => {
        resolve( i )
      } )
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "1" )
    cb( req, res )

    await regevent

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 1 )

    let reginfo = await unregevent

    expect( reginfo ).to.be.a( "object" )
    expect( store.get( req ) ).to.be.false
  } )

  it( `register, auth then send expire`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-----reg ( expires 3600 w-auth)-->|(3)
    |<--------200 ok-------------------|(4)
    |-----reg ( expires 0 w-auth)----->|(5)
    |<--------200 ok-------------------|(6)
    */
    let ourevents = []
    let cb
    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter()
    }

    const registrar = new Registrar( options )

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    let unregevent = new Promise( ( resolve ) => {
      options.em.on( "unregister", ( i ) => {
        resolve( i )
      } )
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    cb( req, res )

    await regevent

    /* Step 5 */
    req = Request.create()
    calculateauth( req, pa, 2 )
    req.set( "Expires", "0" )
    cb( req, res )

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 3600 )
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (6) */

    let reginfo = await unregevent

    expect( reginfo ).to.be.a( "object" )
    expect( store.get( req ) ).to.be.false
  } )

  it( `register with minexpires`, async function() {
    /*
    |---------reg (expires 60)-------->|
    |<--------407 proxy auth-----------|
    |---------reg (expires 60 w-auth)->|
    |<--------423 interval too brief---|
    |-----reg ( expires 3600 w-auth)-->|
    |<--------------200 ok-------------|
    */

    let ourevents = []
    let cb

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      minexpires: 3600
    }

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    const registrar = new Registrar( options )

    let res
    let event423 = new Promise( ( resolve ) => {
      res = {
        send: ( code, body ) => {
          ourevents.push( { code, body } )
          if( 423 == code ) resolve()
        }
      }
    } )

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 2. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "60" )
    cb( req, res )

    await event423

    req = Request.create()
    req.set( "Expires", "3600" )
    calculateauth( req, pa, 2 )

    cb( req, res )

    await regevent

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 )
    expect( ourevents[ 1 ].code ).to.equal( 423 )
    expect( ourevents[ 2 ].code ).to.equal( 200 )
    expect( ourevents[ 2 ].body.headers.Expires ).to.equal( 3600 )

    store.get( req ).destroy()
  } )

  it( `register with regping no second auth`, async function() {
    /*
    |---------reg (expires 3660)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-------reg (expires 3600 w-auth)->|(3)
    |<------200 ok (expires 60)--------|(4)
    |-------reg (expires 60)---------->|(5)
    |<--------------200 ok-------------|(6)

    We should only receive the one event.
    */

    let ourevents = []
    let cb
    let userlookupcount = 0

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        userlookupcount++
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      regping: 60
    }

    const registrar = new Registrar( options )

    let regevent = new Promise( ( resolve ) => {
      options.em.on( "register", ( i ) => {
        resolve( i )
      } )
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    cb( req, res )

    let reginfo = await regevent

    await new Promise( ( r ) => { setTimeout( () => r(), 20 ) } )

    /* Step 5. */
    req = Request.create()
    req.set( "Expires", "60" )

    cb( req, res )

    await new Promise( ( r ) => { setTimeout( () => r(), 20 ) } )

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 60 )
    expect( ourevents[ 2 ].code ).to.equal( 200 ) /* (6) */
    expect( ourevents[ 2 ].body.headers.Expires ).to.equal( 60 )
    expect( userlookupcount ).to.equal( 1 )

    store.get( req ).destroy()

  } )

  it( `register with regping no second auth after stale time`, async function() {
    /*
    |---------reg (expires 3660)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-------reg (expires 1 w-auth)---->|(3)
    |<------200 ok (expires 1)---------|(4)
    delay (at least 0.5 x expires)
    |-------reg (expires 1)----------->|(5)
    |<--------------200 ok-------------|(6)

    We should only receive the one event.
    */

    let ourevents = []
    let cb
    let userlookupcount = 0

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        userlookupcount++
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      regping: 1
    }

    const registrar = new Registrar( options )

    let registerevent = 0
    let regeventresolve
    let regevent = new Promise( ( r ) => { regeventresolve = r } )

    options.em.on( "register", ( i ) => {
      if( 0 === registerevent ) regeventresolve( i )
      registerevent++
    } )

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]

    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "1" )
    cb( req, res )

    let reginfo = await regevent

    await new Promise( ( r ) => { setTimeout( () => r(), 800 ) } )

    /* Step 5. */
    req = Request.create()
    req.set( "Expires", "1" )

    cb( req, res )

    await new Promise( ( r ) => { setTimeout( () => r(), 10 ) } )

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 1 )
    expect( ourevents[ 2 ].code ).to.equal( 200 ) /* (6) */
    expect( ourevents[ 2 ].body.headers.Expires ).to.equal( 1 )
    expect( userlookupcount ).to.equal( 1 )
    expect( registerevent ).to.equal( 1 ) /* only when full expires happens - not when polling frequent expires */

    store.get( req ).destroy()

  } )

  it( `register with regping and all auth`, async function() {
    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-------reg (expires 3600 w-auth)->|(3)
    |<--------------200 ok-------------|(4)
    |-------reg (expires 60 w-auth)--->|(5)
    |<--------------200 ok-------------|(6)
    We should only receive the one event.
    */

    let ourevents = []
    let cb
    let userlookupcount = 0

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          }
      },
      userlookup: ( username, realm ) => {
        userlookupcount++
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      regping: 60
    }

    const registrar = new Registrar( options )

    let registerevent = 0
    let regeventresolve
    let regevent = new Promise( ( r ) => { regeventresolve = r } )

    options.em.on( "register", ( i ) => {
      if( 0 === registerevent ) regeventresolve( i )
      registerevent++
    } )

    let req = Request.create()

    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    cb( req, res )

    let reginfo = await regevent

    await new Promise( ( r ) => { setTimeout( () => r(), 20 ) } )

    /* Step 5 */
    req = Request.create()
    calculateauth( req, pa, 2 )
    req.set( "Expires", "60" )
    cb( req, res )

    await new Promise( ( r ) => { setTimeout( () => r(), 20 ) } )

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 )
    expect( ourevents[ 1 ].code ).to.equal( 200 )
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 60 )
    expect( ourevents[ 2 ].code ).to.equal( 200 )
    expect( ourevents[ 2 ].body.headers.Expires ).to.equal( 60 )
    expect( userlookupcount ).to.equal( 1 )
    expect( registerevent ).to.equal( 1 )

    store.get( req ).destroy()

  } )

  it( `register then options ping and check ping time is updated`, async function() {
    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-------reg (expires 3600 w-auth)->|(3)
    |<--------------200 ok-------------|(4)
    Wait
    |<--------------options------------|(4)
    |---------------200 ok------------>|(4)
    */

    let ourevents = []
    let cb
    let userlookupcount = 0

    let optionspromiseresolve
    let optionspromise = new Promise( ( r ) => optionspromiseresolve = r )

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          },
          request: ( uri, options, requesthandler ) => {
            optionspromiseresolve( { uri, options, requesthandler })
          }
      },
      userlookup: ( username, realm ) => {
        userlookupcount++
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      optionsping: 1
    }

    const registrar = new Registrar( options )

    let registerevent = 0
    let regeventresolve
    let regevent = new Promise( ( r ) => { regeventresolve = r } )

    options.em.on( "register", ( i ) => {
      if( 0 === registerevent ) regeventresolve( i )
      registerevent++
    } )


    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    let pa = ourevents[ 0 ].body.headers[ "Proxy-Authenticate" ]
    req = Request.create()
    calculateauth( req, pa )
    req.set( "Expires", "3600" )
    cb( req, res )

    await regevent

    let preping = store.get( req ).ping
    let optionspacket = await optionspromise

    optionspacket.requesthandler( false, {
      "on": ( event, cb ) => {
        expect( event ).to.equal( "response" )
        cb( { "status": 200 } )
      }
    } )

    let postping = store.get( req ).ping

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 200 ) /* (4) */
    expect( ourevents[ 1 ].body.headers.Expires ).to.equal( 3600 )

    expect( optionspacket.uri ).to.equal( "sip:1000@192.168.0.141:59095;rinstance=302da93c3a2ae72b;transport=UDP" )
    expect( optionspacket.options ).to.have.property( "method" ).that.is.a( "string" )
    expect( optionspacket.options.method ).to.equal( "OPTIONS" )

    expect( optionspacket.options ).to.have.property( "headers" ).that.is.a( "object" )
    expect( optionspacket.options.headers ).to.have.property( "Subject" ).that.is.a( "string" )
    expect( optionspacket.options.headers.Subject ).to.equal( "OPTIONS Ping" )

    expect( preping ).to.not.equal( postping )

    store.get( req ).destroy()
  } )


  it( `fail register auth and check event`, async function() {
    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-------reg (expires 3600 w-auth)->|(3)
    |<--------------403----------------|(4)
    */

    let ourevents = []
    let cb
    let userlookupcount = 0

    let options = {
        srf: {
          use: ( method, fn ) => {
            expect( method ).to.equal( "register" )
            cb = fn
          },
          request: ( uri, options, requesthandler ) => {
          }
      },
      userlookup: ( username, realm ) => {
        userlookupcount++
        expect( username ).to.equal( "bob" )
        expect( realm ).to.equal( "dummy.com" )
        return {
          "secret": "biloxi",
          "display": "Kermit Frog"
        }
      },
      em: new events.EventEmitter(),
      optionsping: 1
    }

    const registrar = new Registrar( options )

    let registerfailedevent = 0
    let failauthobject
    let regeventresolve
    let regevent = new Promise( ( r ) => { regeventresolve = r } )

    options.em.on( "register.auth.failed", ( i ) => {
      failauthobject = i
      if( 0 === registerfailedevent ) regeventresolve( i )
      registerfailedevent++
    } )

    options.em.on( "register", ( i ) => {
      /* this cannot happen */
      expect( false ).to.be.true
    } )


    let res = {
      send: ( code, body ) => {
        ourevents.push( { code, body } )
      }
    }

    /* Step 1. send register */
    let req = Request.create()
    cb( req, res )

    /* Step 3. now auth against auth request */
    req = Request.create()

    /* auth - but break */
    let authstr = `Digest username="bob",
realm="dummy.com",
nonce="wrong",
uri="someuri",
qop=auth,
algorithm=MD5,
nc=00000001,
cnonce="wrongcnonce",
response="123",
opaque="456"`

    req.set( "Proxy-Authorization", authstr )
    req.set( "Expires", "3600" )
    cb( req, res )

    await regevent

    /* Finally check */
    expect( ourevents[ 0 ].code ).to.equal( 407 ) /* (2) */
    expect( ourevents[ 1 ].code ).to.equal( 403 ) /* (4) */
    expect( registerfailedevent ).to.equal( 1 )

    expect( failauthobject ).to.be.an( "object" )
    expect( failauthobject.network.source_address ).to.equal( "some_source_address" )
  } )

  it( `polycom fail reg - captured`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------401 auth-----------------|(2)
    |-------reg (expires 3600 w-auth)->|(3)
    |<--------------200----------------|(4)
    */

    const ourevents = []
    const options = {
      proxy: false,
      regping: 30,
      srf: {
        use: () => {}
      },
      userlookup: ( username, realm ) => {
        ourevents.push( { username, realm } )
        return { username, realm, secret: "sometestsecret" }
      }
    }

    const registrar = new Registrar( options )

    const res = {
      send: ( code, options ) => ourevents.push( { code, options } )
    }

    /* Step 1. send register */
    const req = {
      method: "REGISTER",
      msg: {
        method: "REGISTER",
        uri: "sip:pierrefouquet.babblevoice.com;transport=udp"
      },
      get: ( hdr ) => {
        switch ( hdr ) {
          case "call-id": return "01ebbfc2e6918432f26ce15ef56c01d1"
          case "via": return "SIP/2.0/UDP 82.71.31.12:52917;branch=z9hG4bK86290e16B257FE95"
          case "User-Agent": return "PolycomVVX-VVX_350-UA/5.9.5.0614"
          case "Allow": return
        }
      },
      getParsedHeader: ( hdr ) => {
        switch ( hdr ) {
          case "from": return { uri: "sip:1013@pierrefouquet.babblevoice.com" }
          case "Contact": return [ { uri: "sip:1013@82.71.31.12:52917", params: { methods: "INVITE,ACK,BYE,CANCEL,OPTIONS,INFO,MESSAGE,SUBSCRIBE,NOTIFY,PRACK,UPDATE,REFER" } } ]
        }
      },
      has: ( hdr ) => {
        switch( hdr ) {
          case "User-Agent": return true
          case "from": return true
        }
      },
      source_address: "82.71.31.12",
      source_port: 52917,
      protocol: "udp"
    }
    
    registrar._reg( req, res )

    /* Step 2 */
    expect( ourevents[ 0 ].code ).to.equal( 401 )

    /* Step 3 */
    delete req.registrar

    req.get = ( hdr ) => {
      switch ( hdr ) {
        case "call-id": return "01ebbfc2e6918432f26ce15ef56c01d1"
        case "via": return "SIP/2.0/UDP 82.71.31.12:52917;branch=z9hG4bK86290e16B257FE95"
        case "User-Agent": return "PolycomVVX-VVX_350-UA/5.9.5.0614"
        case "Allow": return
        case "Expires": return "3600"
        case "Authorization": return `Digest username="1013", realm="pierrefouquet.babblevoice.com", nonce="7d4b7aa44cda192fecad03e48a45ca59", qop=auth, cnonce="nrQhP0p3w8fjTMn", nc=00000001, opaque="59ea226be29c979bb10105e8ba654779", uri="sip:pierrefouquet.babblevoice.com;transport=udp", response="ab709ea589a580790e2e1cea141f7107", algorithm=MD5`
        case "Contact": return `<sip:1013@82.71.31.12:52917;transport=udp>;methods="INVITE,ACK,BYE,CANCEL,OPTIONS,INFO,MESSAGE,SUBSCRIBE,NOTIFY,PRACK,UPDATE,REFER"`
      }
    }

    req.getParsedHeader = ( hdr ) => {
      switch ( hdr ) {
        case "from": return { uri: "sip:1013@pierrefouquet.babblevoice.com" }
        case "Contact": return [ { uri: "sip:1013@82.71.31.12:52917", params: { methods: "INVITE,ACK,BYE,CANCEL,OPTIONS,INFO,MESSAGE,SUBSCRIBE,NOTIFY,PRACK,UPDATE,REFER" } } ]
      }
    }

    req.has = ( hdr ) => {
      switch( hdr ) {
        case "User-Agent": return true
        case "from": return true
        case "Authorization": return true
      }
    }

    /* fool our auth */
    const r = store.get( req )
    r._auth._nonce = "7d4b7aa44cda192fecad03e48a45ca59"
    r._auth._opaque = "59ea226be29c979bb10105e8ba654779"

    const p = registrar._reg( req, res )
    if( p ) await p

    expect( ourevents[ 1 ].username ).to.equal( "1013" )
    expect( ourevents[ 1 ].realm ).to.equal( "pierrefouquet.babblevoice.com" )
    expect( ourevents[ 2 ].code ).to.equal( 200 )
    expect( r.allow.length ).to.equal( 12 )

    console.log(ourevents[ 2 ].options)

    r.destroy()

  } )
} )
