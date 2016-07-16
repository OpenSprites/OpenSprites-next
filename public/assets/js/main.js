/**
 * js/main.js
 * ----------
 * 
 * The main website script.
 */

const ajax = require('axios')

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
const ddc = require('./dropdowncheck')

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

let addToCollectionBtn = document.querySelector('.add-to-collection')
if(addToCollectionBtn) {
  (async function(){
    let dataRaw = (await ajax.get('/you/collections')).data
    let data = dataRaw.map(item => ({name: item.name, value: item._id}))
    let collectionAddDropdown = new ddc('Add to collections', data, addToCollectionBtn)
    collectionAddDropdown.cb = function(item, value, check) {
      
    }
  })()
}

if(window.location.pathname.startsWith('/resource'))
  resource_page()

if(document.querySelector("#vis-canvas"))
  visualizer()

for (let el of document.querySelectorAll('.timeago')) {
  el.innerHTML = timeago(parseInt(el.innerHTML))
}

resources.parse()
