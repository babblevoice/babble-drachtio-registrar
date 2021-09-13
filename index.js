/*
  Usage:
  let r = new Registrar( { "srf": srf, "config": config, "userlookup": userlookup } )

  Get an array of domains with users registered to us, i.e. [ "bling.babblevoice.com" ]
  r.realms()

  Get all the users and their registrations at a realm
  r.users( realm )

  Get registrations for a user at a realm
  r.user( realm, username )
*/

const Registrar = require( "./lib/index.js" )

module.exports = Registrar
