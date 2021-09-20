/*
  Usage:

  let r = new Registrar( { "srf": srf, "config": config, "userlookup": userlookup } )

  Get an array of domains with users registered to us, i.e. [ "bling.babblevoice.com" ]
  r.realms()

  Get all the users and their registrations at a realm
  r.users( realm )

  Get registrations for a user at a realm
  r.user( realm, username )

  Classes

  Registrar - our main class (./lib/registrar.js)
  domain - stores a map of users who are registered (./lib/domain.js)
  user - held by domain; stores and handles a list of registrations (./lib/user.js)
  reg - held by user; a registration, with poss. multiple contact fields (./lib/reg.js)

  Our Registrar is our external interface. Srf handles calling us to register. We then
  provide an interface to query registrations.
*/

const { Registrar } = require( "./lib/registrar.js" )

module.exports = Registrar
