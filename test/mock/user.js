/*
  user class
  cf. lib/user.js
*/

class user {

  static defaultMethods = {

    reg: function() {},
    remove: function() {}
  }

  static defaultValues = {

    authorization: {
      username: "some_username"
    }
  }

  static values = user.defaultValues

  constructor( authorization ) {

    this.authorization = authorization || user.values.authorization
    this.registrations = new Map()

    Object.keys( user.values ).forEach( key => {
      this[ key ] = user.values[ key ]
    })
  }

  reg() {}

  remove() {}

  static update = function( newSettings ) {

    const keysProto = Object.getOwnPropertyNames( user.prototype )
    const keysValue = Object.keys( user.values )

    const keys = [ ...keysProto, ...keysValue ]

    for( let key in newSettings ) {
      if( keys.includes( key ) ) {
        if( keysProto.includes( key ) ) user.prototype[ key ] = newSettings[ key ]
        if( keysValue.includes( key ) ) user.values[ key ] = newSettings[ key ]
      }
    }
  }

  static init = function( initialSettings ) {

    user.update( user.defaultMethods )
    user.update( user.defaultValues )
    user.update( initialSettings )

    return new user( initialSettings?.authorization || {} )
  }
}

module.exports = user
