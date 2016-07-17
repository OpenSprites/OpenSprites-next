let backpack = {}

let backpackUI, backpackContent, nothing, template, selectAll, deleteBtn, dlSprite, dlProject, addToCollectionBtn, openScratch, openTosh, openPixie

function load(){
  backpack = JSON.parse(localStorage.backpack)
}

function save(){
  localStorage.backpack = JSON.stringify(backpack)
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
    let itemDom = template.cloneNode(true)
    itemDom.classList.remove('template')
    itemDom._parentItem = item
    
    let thumb = itemDom.querySelector('.backpack-thumb')
    let check = itemDom.querySelector('.backpack-select')
    let name = itemDom.querySelector('.backpack-name .name')
    let type = itemDom.querySelector('.backpack-name .type')
    
    type.textContent = item.type.substring(0, 1).toUpperCase() + item.type.substring(1)
    
    if(item.type == 'resource') {
      thumb.src = '/resources/' + item.id + '/cover'
    } else if(item.type == 'collection') {
      thumb.src = '/collections/' + item.id + '/cover'
    }
    
    name.textContent = item.name
    
    check.addEventListener('change', function(){
      let allChecks = Array.from(backpackContent.querySelectorAll('.backpack-select'))
      let selectedChecks = Array.from(backpackContent.querySelectorAll('.backpack-select:checked'))
      
      if(allChecks.length == selectedChecks.length && selectedChecks.length > 0) {
        selectAll.indeterminate = false
        selectAll.checked = true
        deleteBtn.disabled = false
      } else if(selectedChecks.length > 0) {
        selectAll.indeterminate = true
        deleteBtn.disabled = false
      } else {
        selectAll.indeterminate = false
        selectAll.checked = false
        deleteBtn.disabled = true
      }
    })
    backpackContent.appendChild(itemDom)
  }
}

function update(){
  load()
  render()
}

function init(){
  backpackUI = document.querySelector('.backpack-ui')
  backpackContent = backpackUI.querySelector('.backpack-content')
  nothing = backpackContent.querySelector('.nothing')
  template = backpackUI.querySelector('.backpack-item.template')
  selectAll = backpackUI.querySelector('.select-all')
  deleteBtn = backpackUI.querySelector('.backpack-delete')
  dlSprite = backpackUI.querySelector('.as-sprite')
  dlProject = backpackUI.querySelector('.as-project')
  addToCollectionBtn = backpackUI.querySelector('.backpack-to-collection')
  openScratch = backpackUI.querySelector('.to-scratch')
  openTosh = backpackUI.querySelector('.to-tosh')
  openPixie = backpackUI.querySelector('.to-pixie')
  
  window.addEventListener('storage', function(e) {
    update()
  })
  
  load()
  render()
}

if(window.localStorage) {
  init()
} else {
  document.querySelector('.backpack-ui .backpack-content .nothing').innerHTML = "&nbsp;Hmm, you seem to have an unsupported browser"
}