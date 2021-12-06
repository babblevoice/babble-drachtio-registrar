
const expect = require( "chai" ).expect

const reg = require( "../../lib/reg.js" )
const store = require( "../../lib/store.js" )

const request = require( "../mock/request.js" )
const response = require( "../mock/response.js" )

describe( "store.js", function() {

  afterEach( function() {
    store.clear()
  } )

  it( `store pre auth`, async function() {

    let req = request.create()
    let res = new response()
    let r = new reg( req, res )

    expect( store.stats() ).to.deep.equal( {
      "bycallid": 1,
      "bydomain": 0
    } )

    r.destroy()

    expect( store.stats() ).to.deep.equal( {
      "bycallid": 0,
      "bydomain": 0
    } )
  } )

  it( `store post auth`, async function() {
    let req = request.create( {} )
    let res = new response()
    let r = new reg( req, res )

    r._authorization = {
      "realm": "dummy.com",
      "username": "someuser",
      "nonce": "1234",
      "uri": "someuser@dummy.com",
      "qop": "",
      "response": "",
      "opaque": "",
      "cnonce": "",
      "nc": "",
      "algorithm": ""
    }

    expect( store.stats() ).to.deep.equal( {
      "bycallid": 1,
      "bydomain": 0
    } )

    /* check it doesn't duplicate */
    store.set( r )
    expect( store.stats() ).to.deep.equal( {
      "bycallid": 1,
      "bydomain": 1
    } )

    let d = store.get( req, res )

    r.destroy()

    expect( store.stats() ).to.deep.equal( {
      "bycallid": 0,
      "bydomain": 0
    } )

  } )


  it( `store auth x 2`, async function() {
    let req = request.create()
    let res = new response()
    let r = new reg( req, res )

    r._authorization = {
      "realm": "dummy.com",
      "username": "someuser",
      "nonce": "1234",
      "uri": "someuser@dummy.com",
      "qop": "",
      "response": "",
      "opaque": "",
      "cnonce": "",
      "nc": "",
      "algorithm": ""
    }


    let req2 = request.create()
    req2.set( "call-id", "othercallid" )
    let res2 = new response()
    let r2 = new reg( req2, res2 )

    /* mimick an auth */
    r2._authorization = {
      "realm": "dummy.com",
      "username": "someuser",
      "nonce": "1234",
      "uri": "someuser@dummy.com",
      "qop": "",
      "response": "",
      "opaque": "",
      "cnonce": "",
      "nc": "",
      "algorithm": ""
    }

    store.set( r2 )
    expect( store.stats() ).to.deep.equal( {
      "bycallid": 2,
      "bydomain": 1
    } )

    /* check it doesn't duplicate */
    store.set( r )
    expect( store.stats() ).to.deep.equal( {
      "bycallid": 2,
      "bydomain": 1
    } )

    let regs = store.getdomain( "dummy.com" ).get( "someuser" )
    expect( regs ).to.be.a( "array" ).to.have.lengthOf( 2 )
    expect( regs[ 0 ].contacts ).to.be.a( "array" )
    expect( regs[ 1 ].contacts ).to.be.a( "array" )

    let realms = store.realms()
    expect( realms.length ).to.equal( 1 )
    expect( realms[ 0 ] ).to.equal( "dummy.com" )

    r.destroy()

    expect( store.stats() ).to.deep.equal( {
      "bycallid": 1,
      "bydomain": 1
    } )

    r2.destroy()
    expect( store.stats() ).to.deep.equal( {
      "bycallid": 0,
      "bydomain": 0
    } )
  } )
} )
