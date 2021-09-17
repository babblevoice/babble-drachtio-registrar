/*
  reg class
  cf. lib/reg.js
*/

const { v4: uuidv4 } = require( "uuid" )

const { getSingleton } = require( "../../lib/singleton.js" )
const { prototype } = require("./request.js")


class reg {

  static defaultMethods = {

    update: function() {},
    regping: function() {},
    onexpire: function() {},
    destroy: function() {},
    pingoptions: function() {}
  }

  static defaultGetters = {

    expired: function() {},
    expiring: function() {},
    info: function() {}
  }

  static defaultValues = {

    uuid: uuidv4(),
    initial: true,
    network: {}
  }

  static values = reg.defaultValues

  constructor( req, user ) {

    Object.keys( reg.values ).forEach( key => {
      this[ key ] = reg.values[ key ]
    })

    this.network.source_address = req?.source_address || "some_source_address"
    this.network.source_port = req?.source_port || "some_source_port"
    this.network.protocol = req?.protocol || "some_protocol"

    this.useragent = req?.registrar?.useragent || "some_useragent"
    this.allow = req?.registrar?.allow.toUpperCase().split( /[\s,]+/ ) || [ "SOME", "_", "ALLOW" ]

    this.callid = req?.get?.( "call-id" ) || "some_call-id"

    this.contact = req?.registration?.contact || [ { uri: "some_uri" }, { uri: "some_uri" } ]
    this.aor = req?.registration?.aor || "some_aor"
    this.expires = req?.registration?.expires || 1

    const singleton = getSingleton()

    if ( undefined !== singleton?.options?.regping ) {
      this.expires = singleton?.options?.expires || 1
    }
    this.authorization = user?.authorization || { username: "some_username" }
    this.user = user || {}
    this.registeredat = Math.floor( +new Date() / 1000 )
    this.ping = Math.floor( +new Date() / 1000 )
    if ( undefined !== singleton?.options?.optionsping ) {
      this.optionsintervaltimer = setInterval( this.pingoptions, singleton.options.optionsping * 1000, this )
    }

    // this.regexpiretimer = setTimeout( this.onexpire, this.expires * 1000, this )
  }

  get expired() {}

  get expiring() {}

  get info() {}

  update() {}

  regping() {}

  onexpire() {}

  destroy() {}

  pingoptions() {}

  static update = function( newSettings, obj = reg ) {

    const keysProto = Object.getOwnPropertyNames( reg.prototype )
    const keysGetter = Object.keys( reg.defaultGetters )
    const keysValue = Object.keys( reg.values )

    const keys = [ ...keysProto, ...keysValue ]

    for( let key in newSettings ) {
      if( keys.includes( key ) ) {
        
        if( keysGetter.includes( key ) ) {
          Object.defineProperty( obj, key, {
            get: newSettings[ key ],
            configurable: true
          } )
          continue
        }
        if( keysProto.includes( key ) ) reg.prototype[ key ] = newSettings[ key ]
        if( keysValue.includes( key ) ) reg.values[ key ] = newSettings[ key ]
      }
    }
  }

  static init = function( initialSettings ) {

    reg.update( reg.defaultMethods )
    reg.update( reg.defaultValues )

    reg.update( initialSettings )

    const r = new reg( initialSettings?.req || {}, initialSettings?.user || {} )
    reg.update( initialSettings, r ) // for getters

    return r
  }
}

module.exports = reg
