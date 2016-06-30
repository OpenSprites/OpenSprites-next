/**
 * js/main.js
 * ----------
 * 
 * The main website script.
 */

const join = require('./join')
const share = require('./share')

if('/join' === window.location.pathname)
  join()

if('/share' === window.location.pathname)
  share()