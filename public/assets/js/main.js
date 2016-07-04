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
const resource_page = require('./resource_page')

if('/join' === window.location.pathname)
  join()

if('/share' === window.location.pathname)
  share()

if(document.querySelector('.markdown-about-edit'))
  md()

if(window.location.pathname.startsWith('/resource'))
  resource_page()

for (let el of document.querySelectorAll('.timeago')) {
  el.innerHTML = timeago(parseInt(el.innerHTML))
}

resources.parse()