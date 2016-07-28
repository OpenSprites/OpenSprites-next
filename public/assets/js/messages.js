const ajax = require('axios')

let messagesUI, messagesContainer

function mark() {
  let mark = []
  for(let item of Array.from(messagesContainer.querySelectorAll('.message[data-read="false"]'))) {
    let id = item.dataset.id
    mark.push(id)
  }
  ajax.post('/you/messages/mark', {
    mark,
    csrf: window.csrf
  })
}

async function refresh() {
  let res = await ajax.get('/you/messages')
  messagesContainer.innerHTML = res.data
  mark()
}

function init(){
  messagesUI = document.querySelector('.messages-ui')
  messagesContainer = messagesUI.querySelector('.messages-container')
  window.ajax = ajax
  
  refresh()
  setInterval(refresh, 1000 * 60)
}

if(document.querySelector('.messages-ui'))
  init()

module.exports = {
  refresh
}