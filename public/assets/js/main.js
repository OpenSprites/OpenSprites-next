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
const admin = require('./admin')
const visualizer = require('./visualizer')
const leaving = require('./leaving')
const collection = require('./collection')

require('./cookieconsent')

window.comment = require('./comment')

if('/join' === window.location.pathname)
  join()

if('/share' === window.location.pathname)
  share()

if(window.location.pathname.startsWith('/collections'))
  collection()

if(document.querySelector('.btn.admin-do'))
  admin()

if(document.querySelector('.markdown-about-edit'))
  md()

if(document.querySelector('.bio')) {
  for(let link of Array.from(document.querySelectorAll('.bio a'))) {
    link.addEventListener("click", function(e){
      let isSafe = leaving(this.href)
      if(!isSafe) e.preventDefault()
    })
  }
}

if(window.location.pathname.startsWith('/resource'))
  resource_page()

if(document.querySelector("#vis-canvas"))
  visualizer()

for (let el of document.querySelectorAll('.timeago')) {
  el.innerHTML = timeago(parseInt(el.innerHTML))
}

resources.parse()
