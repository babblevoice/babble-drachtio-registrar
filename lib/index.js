/*
  Classes

  Registrar - our main class (./registrar.js)
  domain - stores a map of users who are registered (./domain.js)
  user - held by domain; stores and handles a list of registrations (each user can have multiple; ./user.js)
  reg - an individual registration, each of which can have multiple contact fields (./reg.js)

  Our Registrar is our external interface. Srf handles calling us to register with us. We then
  provide an interface to query registrations.
*/

const Registrar = require( "./registrar.js" )

module.exports = Registrar
