/**
 * js/main.js
 * ----------
 * 
 * The main website script.
 */

const join = require('./join')
const share = require('./share')
const md = require('./md')
const timeago = require('./timeago')
const resources = require('./resources')

if('/join' === window.location.pathname)
  join()

if('/share' === window.location.pathname)
  share()

if('/users' === window.location.pathname.substr(0, 6))
  md()

if('/collections' === window.location.pathname.substr(0, 12))
  md()

if('/stuff' === window.location.pathname.substr(0, 10))
  md()

for (let el of document.querySelectorAll('.timeago')) {
  el.innerHTML = timeago(parseInt(el.innerHTML))
}

resources.parse()