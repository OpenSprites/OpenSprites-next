const ajax = require('axios')
const collection = require('./collection')

function BackpackItem(type, id, name) {
  return {
    type,
    id,
    name
  }
}

let backpack = {
  items: []
}

let bottomBar, backpackUI, backpackContent, nothing, template, selectAll, deleteBtn, addBtn, dlSprite, dlProject, addToCollectionBtn, openScratch, openTosh, openPixie, status, backpackBtn

let dragBarWasTarget = false

function load() {
  if(localStorage.backpack) {
    backpack = JSON.parse(localStorage.backpack)
  }
}

function save(){
  localStorage.backpack = JSON.stringify(backpack)
}

function isInBackpack(thing) {
  if(typeof thing != 'string') thing = thing.id
  for(let item of backpack.items) {
    if(item.id == thing) return true
  }
  return false
}

async function addToCollection(){
  status.textContent = "Adding..."
  try {
    let items = backpackContent.querySelectorAll('.backpack-select:checked')
    if(items.length == 0){
      items = backpackContent.querySelectorAll('.backpack-select')
    }
    
    items = Array.from(items).map(e => e.parentElement._parentItem)
    
    let res = await ajax.put(location.pathname + '/items', {
        ids: items.map(e => e.id)
      }, {
        'headers': {
          'X-CSRF-Token': window.csrf
        }
    })
    if(!res.data) {
      status.textContent = "Error"
      return
    }
    
    status.textContent = ""
    
    for(let item of items) {
       if(!res.data[item.id].status) {
         status.textContent = "Some items not added"
       }
    }
    
    collection.refresh()
  } catch(e) {
    console.log(e)
    status.textContent = "Error"
  }
}

function render(){
  for(let child of Array.from(backpackContent.querySelectorAll('.backpack-item'))) {
    child.remove()
  }
  if(backpack.items.length == 0) {
    nothing.style.display = 'block'
    return
  }
  nothing.style.display = 'none'
  
  for(let item of backpack.items) {
    addItemDom(item)
  }
}

function addItemDom(item) {
  let itemDom = template.cloneNode(true)
  itemDom.classList.remove('template')
  itemDom._parentItem = item

  let thumb = itemDom.querySelector('.backpack-thumb')
  let check = itemDom.querySelector('.backpack-select')
  let name = itemDom.querySelector('.backpack-name .name')
  let type = itemDom.querySelector('.backpack-name .type')

  type.textContent = item.type.substring(0, 1).toUpperCase() + item.type.substring(1)

  if (item.type == 'resource') {
    thumb.src = '/resources/' + item.id + '/cover'
  } else if (item.type == 'collection') {
    thumb.src = '/collections/' + item.id + '/cover'
  }

  name.textContent = item.name

  check.addEventListener('change', function () {
    let allChecks = Array.from(backpackContent.querySelectorAll('.backpack-select'))
    let selectedChecks = Array.from(backpackContent.querySelectorAll('.backpack-select:checked'))

    if (allChecks.length == selectedChecks.length && selectedChecks.length > 0) {
      selectAll.indeterminate = false
      selectAll.checked = true
      deleteBtn.disabled = false
    } else if (selectedChecks.length > 0) {
      selectAll.indeterminate = true
      deleteBtn.disabled = false
    } else {
      selectAll.indeterminate = false
      selectAll.checked = false
      deleteBtn.disabled = true
    }
  })
  
  itemDom.addEventListener('dragstart', function(e){
    let img = this.querySelector('.backpack-thumb')
    
    e.dataTransfer.clearData();
    e.dataTransfer.setDragImage(img, 0, 0)
    e.dataTransfer.setData('application/opensprites-item+json', JSON.stringify(this._parentItem))
    e.dataTransfer.setData('application/opensprites-item-origin-backpack+text', "yep")
  })
  
  backpackContent.insertBefore(itemDom, backpackContent.children[0])
}

function update(){
  load()
  render()
}

function registerListeners() {
  window.addEventListener('storage', function(e) {
    if(e.key == 'backpack') update()
  })
  
  selectAll.addEventListener('change', function(e){
    Array.from(backpackContent.querySelectorAll('.backpack-select')).forEach(item => item.checked = e.target.checked)
    deleteBtn.disabled = !e.target.value
  })
  
  backpackContent.addEventListener('dragover', function(e) {
    if(e.dataTransfer.types.indexOf("application/opensprites-item-origin-backpack+text") < 0) {
      e.preventDefault()
      this.classList.add('drag')
      e.dataTransfer.dropEffect = 'copy'
      return false
    } else {
      this.classList.remove('drag')
    }
  })
  
  backpackContent.addEventListener('dragleave', function(e){
    this.classList.remove('drag')
  })
  
  backpackContent.addEventListener('drop', function(e){
    e.preventDefault()
    this.classList.remove('drag')
    if(e.dataTransfer.types.indexOf("application/opensprites-item-origin-backpack+text") < 0) {
      let item = JSON.parse(e.dataTransfer.getData('application/opensprites-item+json'))
      if(isInBackpack(item.id)) {
        return false
      }
      
      backpack.items.push(item)
      save()
      addItemDom(item)
      nothing.style.display = 'none'
    }
    
    return false
  })
  
  let messagesUI = bottomBar.querySelector('.messages-ui')
  let backpackUI = bottomBar.querySelector('.backpack-ui')
  let messagesBtn = bottomBar.querySelector('.messages-btn')
  let backpackBtn = bottomBar.querySelector('.backpack-btn')
  let closeBtn = bottomBar.querySelector('.close-btn')
  let fullscreenBtn = bottomBar.querySelector('.fullscreen-btn')
  
  document.addEventListener('dragstart', function(){
    dragBarWasTarget = false
  })
  
  document.addEventListener('dragover', function(e){
    let target = e.target
    let found = false
    do {
      if(target.classList.contains('bottom-main')) {
        found = true
        break
      }
    } while((target = target.parentElement) != null)
    
    if(!found && dragBarWasTarget) {
      bottomBar.classList.remove('active')
      bottomBar.classList.remove('fullscreen')
      backpackBtn.classList.remove('selected')
      messagesBtn.classList.remove('selected')
      fullscreenBtn.classList.remove('selected')
      backpackUI.classList.remove('active')
      messagesUI.classList.remove('active')
      dragBarWasTarget = false
    } else if(found) {
      dragBarWasTarget = true
    }
  })
  
  backpackBtn.addEventListener('dragover', function(){
    messagesBtn.classList.remove('selected')
    messagesUI.classList.remove('active')
    bottomBar.classList.add('active')
    backpackBtn.classList.add('selected')
    backpackUI.classList.add('active')
  })
  
  addBtn.addEventListener('click', function(){
    let type, id, name
    if(OS.resource) {
      type = 'resource'
      id = OS.resource.id
      name = OS.resource.name
    } else if(OS.collection){
      type = 'collection'
      id = OS.collection.id
      name = OS.collection.name
    } else {
      return
    }
    
    if(isInBackpack(id)) {
      return
    }
    
    let item = new BackpackItem(type, id, name)
    backpack.items.push(item)
    save()
    addItemDom(item)
    nothing.style.display = 'none'
  })
  
  deleteBtn.addEventListener('click', function(){
    let selectedItems = Array.from(backpackContent.querySelectorAll('.backpack-select:checked'))
        .map(item => item.parentElement)
    for(let itemDom of selectedItems){
      let id = itemDom._parentItem.id
      
      for(let i = 0; i < backpack.items.length; i++){
        if(backpack.items[i].id == id) {
          backpack.items.splice(i, 1)
        }
      }
      
      itemDom.remove()
      save()
      
      if(backpack.items.length == 0) {
        nothing.style.display = 'block'
        deleteBtn.disabled = true
      }
    }
  })
  
  addToCollectionBtn.addEventListener('click', function(){
    addToCollection()
  })
}

function init(){
  bottomBar = document.querySelector('.bottom-main')
  if(!bottomBar) return
  
  backpackUI = document.querySelector('.backpack-ui')
  backpackContent = backpackUI.querySelector('.backpack-content')
  nothing = backpackContent.querySelector('.nothing')
  template = backpackUI.querySelector('.backpack-item.template')
  selectAll = backpackUI.querySelector('.select-all')
  deleteBtn = backpackUI.querySelector('.backpack-delete')
  addBtn = backpackUI.querySelector('.backpack-add')
  dlSprite = backpackUI.querySelector('.as-sprite')
  dlProject = backpackUI.querySelector('.as-project')
  addToCollectionBtn = backpackUI.querySelector('.backpack-to-collection')
  openScratch = backpackUI.querySelector('.to-scratch')
  openTosh = backpackUI.querySelector('.to-tosh')
  openPixie = backpackUI.querySelector('.to-pixie')
  status = backpackUI.querySelector('.status')
  backpackBtn = document.querySelector('.backpack-btn')
  
  registerListeners()
  
  if(OS.resource || OS.collection) {
    addBtn.disabled = false
  } else {
    addBtn.title = "Add this page to backpack (Not a resource or collection)"
  }
  
  if(OS.collection && OS.collection.canAddItems) {
    addToCollectionBtn.disabled = false
  } else if(OS.collection) {
    addToCollectionBtn.title = "Add to this collection (Not allowed)"
  } else {
    addToCollectionBtn.title = "Add to this collection (Not a collection)"
  }
  
  load()
  render()
}

if(window.localStorage) {
  init()
} else {
  document.querySelector('.backpack-ui .backpack-content .nothing').innerHTML = "&nbsp;Hmm, you seem to have an unsupported browser"
}

module.exports = {
  BackpackItem
}