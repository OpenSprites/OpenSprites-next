/**
 * js/main.js
 * ----------
 *
 * The main website script.
 */
console.log('%copen%csprites','font-family:"Lato",sans-serif;color:#659595;font-size:40px;font-weight:bold', 'font-family:"Lato",sans-serif;color:#659595;font-size:40px')
console.log('https://github.com/OpenSprites/OpenSprites-next')

require('./polyfills')

const ajax = require('axios')

const copy = require('./copy')
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
const backpack = require('./backpack')
const messages = require('./messages')
const vIE = require('./detect-ie')()
const search = require('./search')

if(vIE) {
  if(vIE > 11) {
    console.log('Using Edge :/')
    document.body.classList.add('edge')
  } else {
    console.log('Using IE :(')
    document.body.classList.add('ie')
  }
} else {
  console.log('Not Edge? Not IE?! :D')
}

require('./cookieconsent')

window.comment = require('./comment')

if('/join' === window.location.pathname)
  copy()

if('/share' === window.location.pathname)
  share()

if('/search' === window.location.pathname)
  search()

if(window.location.pathname.startsWith('/collections'))
  collection.init()

if(window.location.pathname.startsWith('/resources'))
  copy()

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
    let what = OS.resource ? OS.resource.id : OS.collection.id
    let dataRaw = (await ajax.get('/you/collections?what=' + what)).data
    let data = []
    for(let id in dataRaw){
      data.push({name: dataRaw[id].name, value: id})
    }

    let collectionAddDropdown = new ddc('Add to collections', data, addToCollectionBtn)

    for(let id in dataRaw) {
      collectionAddDropdown.set(id, !!dataRaw[id].has)
    }

    collectionAddDropdown.cb = async function(item, value, check) {
      collectionAddDropdown.setEnabled(false)
      collectionAddDropdown.setStatus("Loading")

      let url = value ? `/collections/${item}/items` : `/collections/${item}/items/delete`
      let method = value ? 'put' : 'post'

      try {
        let res = await (ajax[method])(url, {
          ids: [what]
        }, {
          'headers': {
            'X-CSRF-Token': window.csrf
          }
        })
        if(!res.data || !res.data[what]) throw "Didn't get response"
        collectionAddDropdown.setEnabled(true)
        collectionAddDropdown.setStatus("")
      } catch(e){
        console.log(e)
        collectionAddDropdown.set(item, !value)
        collectionAddDropdown.setEnabled(true)
        collectionAddDropdown.setStatus("Error")
      }
    }
  })()
}

if(window.location.pathname.startsWith('/resource'))
  resource_page()

if(document.querySelector("#vis-canvas"))
  visualizer()

for (let el of document.querySelectorAll('.timeago')) {
  el.innerHTML = timeago(parseInt(el.innerHTML))
  el.setAttribute('title', el.innerHTML)
}

resources.parse()

let bottomBar = document.querySelector('.bottom-main')
if (bottomBar) {
  let messages = bottomBar.querySelector('.messages-ui')
  let backpack = bottomBar.querySelector('.backpack-ui')
  let messagesBtn = bottomBar.querySelector('.messages-btn')
  let backpackBtn = bottomBar.querySelector('.backpack-btn')
  let closeBtn = bottomBar.querySelector('.close-btn')
  let fullscreenBtn = bottomBar.querySelector('.fullscreen-btn')

  messagesBtn.addEventListener('click', function () {
    backpackBtn.classList.remove('selected')
    backpack.classList.remove('active')
    if (this.classList.contains('selected')) {
      bottomBar.classList.remove('active')
      bottomBar.classList.remove('fullscreen')
      this.classList.remove('selected')
      fullscreenBtn.classList.remove('selected')
      messages.classList.remove('active')
    } else {
      bottomBar.classList.add('active')
      this.classList.add('selected')
      messages.classList.add('active')
    }
  })

  backpackBtn.addEventListener('click', function () {
    messagesBtn.classList.remove('selected')
    messages.classList.remove('active')
    if (this.classList.contains('selected')) {
      bottomBar.classList.remove('active')
      bottomBar.classList.remove('fullscreen')
      this.classList.remove('selected')
      fullscreenBtn.classList.remove('selected')
      backpack.classList.remove('active')
    } else {
      bottomBar.classList.add('active')
      this.classList.add('selected')
      backpack.classList.add('active')
    }
  })

  closeBtn.addEventListener('click', function () {
    bottomBar.classList.remove('active')
    bottomBar.classList.remove('fullscreen')
    backpackBtn.classList.remove('selected')
    messagesBtn.classList.remove('selected')
    fullscreenBtn.classList.remove('selected')
    backpack.classList.remove('active')
    messages.classList.remove('active')
  })

  fullscreenBtn.addEventListener('click', function () {
    if (this.classList.contains('selected')) {
      this.classList.remove('selected')
      bottomBar.classList.remove('fullscreen')
    } else {
      this.classList.add('selected')
      bottomBar.classList.add('fullscreen')
    }
  })
}
