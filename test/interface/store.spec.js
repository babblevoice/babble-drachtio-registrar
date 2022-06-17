
const calculateauth = require( "../util/auth.js" ).calculateauth

const should = require( "chai" ).should()
const expect = require( "chai" ).expect


const store = require( "../../lib/store.js" )
const Request = require( "../mock/request.js" )

const registrar = require( "../../index.js" )
const events = require( "events" )


describe( "store", function() {
  it( `register then check more details on our store for regstration`, async function() {

    /*
    |---------reg (expires 3600)------>|(1)
    |<--------407 proxy auth-----------|(2)
    |-----reg ( expires 3600 w-auth)-->|(3)
    |<--------200 ok-------------------|(4)
    Then check our store public interface
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
    const r = new registrar( options )

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

    let userreginfo = await r.user( "dummy.com", "bob" )
    let contacts = await r.contacts( "bob@dummy.com" )
    /* the fuller extend of this structure is checked elsewhere */
    expect( userreginfo ).to.be.a( "array" ).to.have.lengthOf( 1 )
    expect( userreginfo[ 0 ].contacts ).to.be.a( "array" ).to.have.lengthOf( 1 )

    expect( contacts ).to.be.a( "object" )
    expect( contacts.username ).to.be.a( "string" ).to.equal( "bob" )
    expect( contacts.realm ).to.be.a( "string" ).to.equal( "dummy.com" )
    expect( contacts.display ).to.be.a( "string" ).to.equal( "Kermit Frog" )
    expect( contacts.uri ).to.be.a( "string" ).to.equal( "bob@dummy.com" )
    expect( contacts.contacts ).to.be.a( "array" ).to.have.lengthOf( 1 )
    expect( contacts.contacts[ 0 ].contact ).to.be.a( "string" ).to.equal( "sip:1000@192.168.0.141:59095;rinstance=302da93c3a2ae72b;transport=UDP" )
    expect( contacts.contacts[ 0 ].network ).to.be.a( "object" )
    expect( contacts.contacts[ 0 ].network.rport ).to.be.true

    userreginfo = await r.user( { "realm": "dummy.com", "username": "bob" } )
    expect( userreginfo ).to.be.a( "array" ).to.have.lengthOf( 1 )
    expect( userreginfo[ 0 ].contacts ).to.be.a( "array" ).to.have.lengthOf( 1 )

    userreginfo = await r.user( { "uri": "bob@dummy.com" } )
    expect( userreginfo ).to.be.a( "array" ).to.have.lengthOf( 1 )
    expect( userreginfo[ 0 ].contacts ).to.be.a( "array" ).to.have.lengthOf( 1 )

    store.get( req ).destroy()

  } )
} )
