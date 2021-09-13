/*
  user class
  cf. lib/user.js
*/

class user {

  static defaultValues = {

    registrations: new Map(),
    authorization: "some_authorization"
  }

  static values = user.defaultValues

  constructor() {
    Object.keys( user.values ).forEach( key => {
      this[ key ] = user.values[ key ]
    })
  }

  reg = () => {}

  remove = () => {}

  static update = function( newValues ) {
    const keys = Object.keys( user.values )
    for( let key in newValues ) {
      if( keys.includes( key ) ) {
        user.values[ key ] = newValues[ key ]
      }
    }
  }

  static init = function( initialValues ) {
    user.update( user.defaultValues )
    user.update( initialValues )
    return new user()
  }
}

module.exports = user
