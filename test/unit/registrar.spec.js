/*
  Dependencies
*/

const { EventEmitter } = require( "events" )

const should = require( "chai" ).should()
const expect = require( "chai" ).expect

const request = require( "../mock/request.js" )
const response = require( "../mock/response.js" )

const registrar = require( "../../lib/registrar.js" )
const store = require( "../../lib/store.js" )


describe( "registrar.js", function() {

  it( "exports the Registrar class", function() {

    registrar.name.should.equal( "Registrar" )
    String( registrar ).slice( 0, 5 ).should.equal( "class" )

  } )

  it( "returns an instance of itself when called with the new keyword", function() {

    const r = new registrar( { srf: { use: () => {} } } )
    r.should.be.an.instanceof( registrar )

  } )

  it( "sets the options property to a merger of defaults and options passed", function() {

    const em = new EventEmitter()
    const r = new registrar( { "em": em, "srf": { use: () => {} } } )

    expect( r.options.expires ).to.equal( 3600 )
    expect( r.options.minexpires ).to.equal( 3600 )
    expect( r.options.staletime ).to.equal( 300 )
    expect( r.options.authtimeout ).to.equal( 60000 )
  } )

  it( "sets the options em property if not set on options passed", function() {

    const r = new registrar( { srf: { use: () => {} } } )
    const em = new EventEmitter()
    r.options.em.should.eql( em )

  } )

  it( "sets an event listener for an event and a callback passed", function() {

    const em = new EventEmitter()

    const r = new registrar( { em, srf: { use: () => {} } } )

    r.on( "some_event", data => {
      data.should.equal( "some_data" )
    } )

    em.emit( "some_event", "some_data" )

  } )

  it( "invokes the callback if the request method property is not \"REGISTER\"", function() {

    const r = new registrar( { srf: { use: () => {} } } )

    const req = request.create()
    req.method = "NOT_REGISTER"

    let hascalled = false
    r._reg( req, {}, () => { hascalled = true } )

    hascalled.should.equal( true )

  } )

  it( "calls the options userlookup method passing the username and realm parameters", function() {

    const r = new registrar( {
      srf: { use: () => {} },
      userlookup: ( username, realm ) => {
        runShould( username, realm )
        return new Promise( ( res ) => { res( "some_value" ) } )
      }
    } )

    const runShould = ( username, realm ) => {
      username.should.equal( "1000" )
      realm.should.equal( "some.realm" )
    }

    const req = request.create()

    const intercept = options => () => {
      options.passwordLookup( "1000", "some.realm", () => {} )
    }

    r._reg( req, response.create() , () => {}, intercept )
    store.get( req ).destroy()

  } )

  it( "invokes the callback passing false and the user secret property in the options userlookup method success case", function() {

    const r = new registrar( {
      srf: { use: () => {} },
      userlookup: () => {
        return new Promise( ( res ) => { res( { secret: "some_secret" } ) } )
      }
    } )

    const runShould = ( boolean, secret ) => {
      setTimeout( () => {
        boolean.should.equal( false )
        secret.should.equal( "some_secret" )
      }, 1 )
    }

    const req = request.create( { registration: { aor: "sip:1000@some.realm" } }, false ) // no registrar property

    const intercept = options => () => {
      options.passwordLookup( "1000", "some.realm", runShould )
    }

    r._reg( req, response.create(), () => {}, intercept )
    store.get( req ).destroy()
  } )

  it( "invokes the callback passing false and false in the options userlookup method failure case", function() {

    const r = new registrar( {
      srf: { use: () => {} },
      userlookup: () => {
        return new Promise( ( res, rej ) => { rej( "some_value" ) } )
      }
    } )

    const runShould = ( boolean, secret ) => {
      setTimeout( () => {
        boolean.should.equal( false )
        secret.should.equal( false )
      }, 1 )
    }

    const req = request.create()

    const intercept = options => () => {
      options.passwordLookup( "1000", "some.realm", runShould )
    }

    r._reg( req, response.create(), () => {}, intercept )
    store.get( req ).destroy()
  } )

  it( "returns an empty array if the key passed is not present on the domains property", async function() {

    const r = new registrar( { srf: { use: () => {} } } )
    const users = await r.users( "some.domain" )
    users.should.eql( [] )

  } )

  it( "returns an empty array if the realm passed is not present on the domains property", async function() {

    const r = new registrar( { srf: { use: () => {} } } )

    const result = await r.user( "some.realm", "some_user" )

    result.should.eql( [] )

  } )
} )
