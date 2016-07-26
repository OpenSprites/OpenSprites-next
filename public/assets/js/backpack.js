const ajax = require('axios')
const collection = require('./collection')
const dndrenderer = require('./dndrenderer')

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

let bottomBar, backpackUI, backpackContent, nothing, template, deleteBtn, addBtn, dlSprite, dlProject, openScratch, openTosh, openPixie, status, backpackBtn

let dragBarWasTarget = false
let firstSelectedItem

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

async function download(type, dontOpen) {
  let selectedItems = Array.from(backpackContent.querySelectorAll('.backpack-item')).map( item => item._parentItem.id )
  status.textContent = "Preparing download..."
  try {
    [dlSprite, dlProject, openScratch, openTosh, openPixie].forEach(item => item.disabled = true)
    let res = await ajax.post('/collections/download', {
      type,
      which: selectedItems
    }, {
      'headers': {
        'X-CSRF-Token': window.csrf
      }
    })
    
    if(res.data.downloadId){
      if(dontOpen) {
        [dlSprite, dlProject, openScratch, openTosh, openPixie].forEach(item => item.disabled = false)
        return '/collections/download/' + res.data.downloadId + '/backpack-items'
      } else {
        document.querySelector("#dlframe").src = '/collections/download/' + res.data.downloadId + '/backpack-items'
      }
      status.textContent = ""
    } else {
      throw "Didn't get a response"
    }
  } catch(e){
    console.log(e)
    status.textContent = "Error"
  }
  [dlSprite, dlProject, openScratch, openTosh, openPixie].forEach(item => item.disabled = false)
}

async function openIn(type) {
  try {
    let url = await download('project', true)
    if(!url) throw "Failed to download"
  } catch(e){
    console.log(e)
    return
  }
  if(type == 'scratch') {
    try {
      status.textContent = "Loading editor..."
      let FlashApp = await embedScratch()
      FlashApp.ASloadProjectUrl(url)
      status.textContent = ""
    } catch(e) {
      console.log(e)
      status.textContent = "Error"
    }
  }
}

function embedScratch() {
  return new Promise(function(resolve, reject){
    let FlashApp = document.querySelector('#opensprites-editor')
    if(FlashApp.tagName.toLowerCase() != "object") {
      window.JSthrowError = function(err){
        console.log("Flash error", err)
      }
    
      window.JSloadProjectUrlCallback = function(err){
          if(err){
              console.error("Failed to load project: ", err);
          } else {
              console.log("Loaded project")
          }
      }
    
      window.JSlogoButtonPressed = function(){
          let FlashApp = document.querySelector('#opensprites-editor')
          FlashApp.classList.remove("active")
      }
      
      window.JSeditorReady = function() {
        let FlashApp = document.querySelector('#opensprites-editor')
		    resolve(FlashApp)
      }
    
		  var swf = "/assets/swf/OpenSprites-Editor.swf?hash=ffa2b59";
		  var flashvars = {};
		  swfobject.embedSWF(swf, "opensprites-editor", '100%', '100%', "11.6.0", false, flashvars, {
		    allowscriptaccess: "always",
		    allowfullscreen: "true",
		    wmode: "direct",
		    menu: "false"
		  }, null, function(obj){
		    if(!obj || !obj.success) {
		      reject("No flash support")
		    } else {
		      let FlashApp = document.querySelector('#opensprites-editor')
		      FlashApp.classList.add("active")
			  }
		  });
    } else {
      FlashApp.classList.add("active")
      resolve(FlashApp)
    }
  })
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
  let name = itemDom.querySelector('.backpack-name .name')
  let type = itemDom.querySelector('.backpack-name .type')

  type.textContent = item.type.substring(0, 1).toUpperCase() + item.type.substring(1)

  if(item.flags && item.flags.script) {
    ajax.get(`/resources/${item.id}/raw`).then(function(res){
      let script = res.data
      var scriptDoc = new scratchblocks.Document(scratchblocks.fromJSON({scripts: [[0,0, script]]}).scripts);
      scriptDoc.render(function(svg) {
        svg.classList.add('backpack-thumb')
        thumb.parentElement.insertBefore(svg, thumb.nextElementSibling)
        thumb.remove()
      })
    })
  } else if (item.type == 'resource') {
    thumb.src = '/resources/' + item.id + '/cover'
  } else if (item.type == 'collection') {
    thumb.src = '/collections/' + item.id + '/cover'
  }

  name.textContent = item.name
  itemDom.title = item.name
  
  itemDom.addEventListener('dragstart', function(e){
    let img = this.querySelector('.backpack-thumb')
    
    this.classList.add('selected')
    
    let items = Array.from(backpackContent.querySelectorAll('.backpack-item.selected')).map(e=> e._parentItem)
    
    e.dataTransfer.clearData()
    if(items.length > 1) {
     img = dndrenderer.nItems(items.length, 100)
    }
    e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2)
    e.dataTransfer.setData('application/opensprites-items+json', JSON.stringify(items))
    e.dataTransfer.setData('application/opensprites-item-origin-backpack+text', "yep")
  })
  
  itemDom.addEventListener('dblclick', function(e){
    let item = this._parentItem
    switch(item.type){
      case 'resource':
      case 'collection':
        window.open(`/${item.type}s/${item.id}`, '_blank')
        break
    }
  })
  
  itemDom.addEventListener('click', function(e){
    if(e.ctrlKey || e.metaKey) {
      if(this.classList.contains('selected')) {
        this.classList.remove('selected')
      } else {
        let sel = Array.from(backpackContent.querySelectorAll('.backpack-item.selected'))
        sel.push(this)
        Array.from(backpackContent.querySelectorAll('.backpack-item.selected')).forEach(item => item.classList.remove('selected'))
        sel.forEach(item => item.classList.add('selected'))
      }
    } else if(e.shiftKey) {
      let all = Array.from(backpackContent.querySelectorAll('.backpack-item'))
      let firstIndex = all.indexOf(firstSelectedItem)
      let myIndex = all.indexOf(this)
      Array.from(backpackContent.querySelectorAll('.backpack-item.selected')).forEach(item => item.classList.remove('selected'))
      
      if(firstIndex < 0 || firstIndex == myIndex) {
        this.classList.add('selected')
        firstSelectedItem = this
        return
      }
      
      for(let i = firstIndex; firstIndex < myIndex ? i <= myIndex : i >= myIndex; firstIndex < myIndex ? i++ : i--) {
        all[i].classList.add('selected')
      }
    } else {
      Array.from(backpackContent.querySelectorAll('.backpack-item.selected')).forEach(item => item.classList.remove('selected'))
      this.classList.add('selected')
      firstSelectedItem = this
    }
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
      JSON.parse(e.dataTransfer.getData('application/opensprites-items+json')).forEach(function(item){
        if(isInBackpack(item.id)) {
          return false
        }
      
        backpack.items.push(item)
        save()
        addItemDom(item)
        nothing.style.display = 'none'
      })
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
    if(OS.resource) item.flags = OS.resource.flags
    backpack.items.push(item)
    save()
    addItemDom(item)
    nothing.style.display = 'none'
  })
  
  deleteBtn.addEventListener('click', function(){
    let selectedItems = Array.from(backpackContent.querySelectorAll('.backpack-item.selected'))
    if(selectedItems.length == 0){
      selectedItems = Array.from(backpackContent.querySelectorAll('.backpack-item'))
    }
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
      }
    }
  })
  
  dlSprite.addEventListener('click', function(){
    download('sprite')
  })
  dlProject.addEventListener('click', function(){
    download('project')
  })
  
  openScratch.addEventListener('click', function(){
    openIn('scratch')
  })
}

function init(){
  bottomBar = document.querySelector('.bottom-main')
  if(!bottomBar) return
  
  backpackUI = document.querySelector('.backpack-ui')
  backpackContent = backpackUI.querySelector('.backpack-content')
  nothing = backpackContent.querySelector('.nothing')
  template = backpackUI.querySelector('.backpack-item.template')
  deleteBtn = backpackUI.querySelector('.backpack-delete')
  addBtn = backpackUI.querySelector('.backpack-add')
  dlSprite = backpackUI.querySelector('.as-sprite')
  dlProject = backpackUI.querySelector('.as-project')
  openScratch = backpackUI.querySelector('.to-scratch')
  openTosh = backpackUI.querySelector('.to-tosh')
  openPixie = backpackUI.querySelector('.to-pixie')
  status = backpackUI.querySelector('.status')
  backpackBtn = document.querySelector('.backpack-btn')
  
  registerListeners()
  
  if(OS.resource) {
    addBtn.querySelector('.label').textContent = "Add this resource"
  } else if(OS.collection){
    addBtn.querySelector('.label').textContent = "Add this collection"
  } else {
    addBtn.style.display = "none"
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
  BackpackItem,
  addItem: function(item){
    if(isInBackpack(item.id)) {
      return false
    }
    
    backpack.items.push(item)
    save()
    addItemDom(item)
    nothing.style.display = 'none'
  }
}