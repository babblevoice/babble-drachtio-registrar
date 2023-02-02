const expect = require( "chai" ).expect

const Request = require( "../mock/request.js" )
const reg = require( "../../lib/reg.js" )
const store = require( "../../lib/store.js" )

/*
  Assertions
*/

describe( "reg.js", function() {

  afterEach( function() {
    store.clear()
  } )

  it( "exports the reg class", function() {

    reg.name.should.equal( "reg" )
    String( reg ).slice( 0, 5 ).should.equal( "class" )

  } )

  it( "returns an instance of itself when called with the new keyword", function() {

    const res = {
      send: () => {
      }
    }

    const registrar = { options: {} }
    const u = { options: registrar.options }

    const r = new reg( Request.create(), res, u )

    r.should.be.an.instanceof( reg )

    r.destroy()

  } )

  it( "properties", function() {
    const registrar = { options: { divisor: 1000 } }
    const u = { authorization: { username: "some_user" }, options: registrar.options }

    const res = {
      send: () => {
      }
    }

    const r = reg.create( Request.create(), res, u )

    expect( r ).to.have.property( "uuid" ).that.is.a( "string" )
    expect( r ).to.have.property( "_initial" ).that.is.a( "boolean" ).to.be.true
    expect( r ).to.have.property( "_authed" ).that.is.a( "boolean" ).to.be.false
    expect( r ).to.have.property( "network" ).that.is.a( "object" )
    expect( r.network ).to.have.property( "source_address" ).that.is.a( "string" ).to.equal( "some_source_address" )
    expect( r.network ).to.have.property( "source_port" ).that.is.a( "number" )
    expect( r.network ).to.have.property( "protocol" ).that.is.a( "string" ).to.equal( "some_protocol" )
    expect( r ).to.have.property( "useragent" ).that.is.a( "string" )
    expect( r ).to.have.property( "allow" ).that.is.a( "array" )
    expect( r ).to.have.property( "callid" ).that.is.a( "string" )
    expect( r ).to.have.property( "_fqcallid" ).that.is.a( "string" )
    expect( r ).to.have.property( "_options" ).that.is.a( "object" )
    expect( r ).to.have.property( "contact" ).that.is.a( "array" )
    expect( r ).to.have.property( "expires" ).that.is.a( "number" )
    expect( r ).to.have.property( "registeredat" ).that.is.a( "number" )
    expect( r ).to.have.property( "ping" ).that.is.a( "number" )

    r.destroy()

  } )

  it( "returns a boolean value for expiry elapsed", function() {

    const res = {
      send: () => {
      }
    }

    const expires = 2

    const options = { regping: () => {}, expires }
    const r = reg.create( Request.create(), res, options ) // 1

    /* fool */
    r.registeredat -= ( expires + 1 )

    r.expired.should.be.a( "boolean" )
    r.expired.should.equal( true )

    r.destroy()

  } )

  it( "returns a boolean value for expiry approaching", function() {

    const res = {
      send: () => {
      }
    }

    const expires = 10

    const options = { regping: () => {}, expires }
    const r = reg.create( Request.create(), res, options ) // 1

    /* fool */
    r.registeredat -= ( ( expires / 2 ) + 1 )

    r._expiring.should.be.a( "boolean" )
    r._expiring.should.equal( true )

    r.destroy()

  } )

  it( "reg.info returns correct structure", function() {

    const res = {
      send: () => {
      }
    }

    const registrar = { options: {} }
    const u = { authorization: {}, options: registrar.options }

    const r = reg.create( Request.create(), res, u )
    const info = r.info()

    expect( info ).to.have.property( "uuid" ).that.is.a( "string" )
    expect( info ).to.have.property( "initial" ).that.is.a( "boolean" )
    expect( info ).to.have.property( "contacts" ).that.is.a( "array" )
    expect( info ).to.have.property( "callid" ).that.is.a( "string" )
    expect( info ).to.have.property( "useragent" ).that.is.a( "string" )
    expect( info ).to.have.property( "allow" ).that.is.a( "array" )
    expect( info ).to.have.property( "network" ).that.is.a( "object" )
    expect( info.network ).to.have.property( "source_address" ).that.is.a( "string" )
    expect( info.network ).to.have.property( "source_port" ).that.is.a( "number" )
    expect( info.network ).to.have.property( "protocol" ).that.is.a( "string" )
    expect( info ).to.have.property( "expiresat" ).that.is.a( "number" )
    expect( info ).to.have.property( "expiresin" ).that.is.a( "number" )
    expect( info ).to.have.property( "expires" ).that.is.a( "number" )
    expect( info ).to.have.property( "registeredat" ).that.is.a( "number" )
    expect( info ).to.have.property( "stale" ).that.is.a( "boolean" )

    r.destroy()

  } )

  it( "returns an expiresat property being the sum of the registeredat and expires properties", function() {

    const res = {
      send: () => {
      }
    }

    const registrar = { options: {} }
    const u = { options: registrar.options }

    const r = reg.create( Request.create(), res, u )
    const info = r.info()
    expect( info.registeredat ).to.equal( info.expiresat - info.expiresin )

    r.destroy()

  } )

  it( "returns a stale property being a boolean generated with the ping and registrar options staletime properties", function() {

    const res = {
      send: () => {
      }
    }

    const options = { staletime: 1 }
    const r = new reg( Request.create(), res, options )

    r.ping = r._now() - 2

    const info = r.info()

    info.stale.should.be.a( "boolean" )
    info.stale.should.equal( true )

    r.destroy()

  } )
} )
