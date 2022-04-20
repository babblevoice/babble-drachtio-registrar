
const assert = require( "assert" )
const events = require( "events" )

const parseuri = require( "drachtio-srf" ).parseUri

const reg = require( "./reg.js" )
const store = require( "./store.js" )

/**
External interface, primary class. Stores and handles a map of domains.
@class
*/
class Registrar {

  /**
  Instantiates the Registrar class.
  @constructor
  @param { object } options - the object extending or overriding the defaults
  */
  constructor( options ) {

    /**
      @typedef {Object} userinfo
      @property {string} secret
      @property {string} display
    */
    /**
      Callback we call for caller to provide user information.
      @callback options.userlookup
      @param {string} username
      @param {string} realm
      @returns {userinfo}
    */

    /**
      @typedef {Object} options
      @property {options.userlookup} userlookup
      @property {EventEmitter} em - event emitter
      @property {Srf} srf - Drachtio srf object so we can send options
      @property {number} expires=3600 (S)
      @property {number} minexpires=3600 (S)
      @property {number} staletime=300 (S)
      @property {number} authtimeout=5000 (mS) from sending our authrequired to removal and failing
      @property {number} [optionsping] - (S) interval to send an options packet
      @property {number} [regping] - (S) interval which we us register as a ping - no auth will be done - auth is only done on expires must be less than expires
    */

    const defaults = {
      expires: 3600,
      minexpires: 3600,
      staletime: 300,
      authtimeout: 5000
    }

    if( undefined === options.em ) {
      options.em = new events.EventEmitter()
    }

    this.options = {
      ...defaults,
      ...options
    }

    this.options.srf.use( "register", this._reg.bind( this ) )
  }

  static get store() {
    return store
  }

  /**
  Handles registration:
  - throws an error if the registrar instance has been used more than once
  - invokes next if the request method is not REGISTER
  - parses the req.registration.aor property and calls the _isauthed method to get the registration
  - if the registration is returned, calls reg.onexpire if expired else calls reg.regping and the _sendok method passing the request and response
  - else parses the request To header URI passes to the digest authentication function:
    - an options object containing the host parsed and a passwordLookup callback
    - the request, the response and an onauth callback which:
      - sets the req.registrar.contact, .useragent, .allow and .expires properties
      - calls res.send and returns if the options.regping method is not present and the req.registrar.expires property is non-zero and less than the options.minexpires property
      - adds a new domain instance by realm if not present
      - gets the domain, calls domain.reg and emits the register event with information on the registration
      - deletes the domain if no users are present
      - calls the _sendok method passing the request and response
  @private
  @param { Request } req - the incoming request
  @param { Response } res - the outgoing response
  @param { function } next - a callback
  */
  _reg( req, res, next ) {

    assert( req.registrar === undefined, "Registrar has been used twice" )
    req.registrar = {}
    if ( req.method !== "REGISTER" ) return next()

    let r = store.get( req, res, this.options )
    if( r ) return r._update( req, res )

    reg.create( req, res, this.options )
  }

  /**
  Gets the names of all domains:
  - returns an array containing the keys of the domains property
  @method
  */
  async realms() {
    return store.realms()
  }

  /**
  Gets information on all user registrations for a realm:
  - returns an array containing info from reg.info for all user registrations at a realm if present
  - else returns an empty array
  @method
  @param { string } realm - the name of the domain
  */
  async users( realm ) {
    if ( !store.has( realm ) ) {
      return []
    }
    return store.getdomain( realm ).info()
  }

  /**
  Gets information on all registrations for a user at a realm:
  - parses the host and username from the realm if the username is not passed
  - returns an array containing info from reg.info for all registrations for the user if present
  - else returns an empty array

  Usage options:
  - user( "bling.babblevoice.com", "1000" )
  - user( "1000@bling.babblevoice.com" )

  Method async for future storage of registrations in Redis or similar.
  @param { string | object } realm - the name of the domain, or the full address or entity object
  @param { string } [ realm.username ] - username - if not present uri must be present, if present realm must be present
  @param { string } [ realm.realm ] - used in conjunction with username
  @param { string } [ realm.uri ] - user@realm
  @param { string } username - the name of the user
  */
  async user( realm, username ) {

    if ( undefined === username ) {
      if( "object" === typeof realm ) {
        if( undefined !== realm.username && undefined !== realm.realm ) {
          username = realm.username
          realm = realm.realm
        } else {
          const parsed = parseuri( "sip:" + realm.uri )
          realm = parsed.host
          username = parsed.user
        }
      } else {
        const parsed = parseuri( "sip:" + realm )
        realm = parsed.host
        username = parsed.user
      }
    }

    if ( !store.has( realm ) ) return []

    return store.getdomain( realm ).get( username )
  }

  /**
    @typedef { Object } contacts
    @property { string } username
    @property { string } realm
    @property { string } display
    @property { string } uri
    @property { array.< string > } contacts
  */

  /**
  Colates all of the contacts for all registrations for a user@domain into a
  single contact array to ease calling multiple registrations.

  Identical in usage to user()

  @param { string | object } realm - the name of the domain, or the full address or entity object
  @param { string } [ realm.username ] - username - if not present uri must be present, if present realm must be present
  @param { string } [ realm.realm ] - used in conjunction with username
  @param { string } [ realm.uri ] - user@realm
  @param { string } username - the name of the user
  */
  async contacts( realm, username ) {

    if ( undefined === username ) {
      if( "object" === typeof realm ) {
        if( undefined !== realm.username && undefined !== realm.realm ) {
          username = realm.username
          realm = realm.realm
        } else {
          const parsed = parseuri( "sip:" + realm.uri )
          realm = parsed.host
          username = parsed.user
        }
      } else {
        const parsed = parseuri( "sip:" + realm )
        realm = parsed.host
        username = parsed.user
      }
    }

    let regs = await this.user( realm, username )
    if( 0 === regs.length ) {
      return {
        username,
        realm,
        "display": "",
        "uri": username + "@" + realm,
        "contacts": []
      }
    }

    let contacts = {
      username,
      realm,
      "display": regs[ 0 ].auth.display,
      "uri": username + "@" + realm,
      "contacts": []
    }

    for( const reg of regs ) {
      for( const contact of reg.contacts ) {
        contacts.contacts.push( contact )
      }
    }
    return contacts
  }
}

module.exports = Registrar
