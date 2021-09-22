/*
  Overview:

  Srf handles calling us to register. We then provide an interface to query registrations.

  Usage:

  let r = new Registrar( { "srf": srf, "config": config, "userlookup": userlookup } )

  Get an array of domains with users registered to us, i.e. [ "bling.babblevoice.com" ]
  r.realms()

  Get all the users and their registrations at a realm
  r.users( realm )

  Get registrations for a user at a realm
  r.user( realm, username )

  Classes:

  Registrar - external interface, primary class; stores and handles a map of domains (./lib/registrar.js)
  domain - held by registrar; stores and handles a map of users who are registered (./lib/domain.js)
  user - held by domain; stores and handles a map of user registrations (./lib/user.js)
  reg - held by user; a registration, allowed multiple contact fields (./lib/reg.js)
*/

const Registrar = require( "./lib/registrar.js" )

module.exports = Registrar
