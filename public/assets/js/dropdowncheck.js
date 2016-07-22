module.exports = function(name, items, existingDom){
  let dom = existingDom || document.createElement('div')
  dom.classList.add('dropdowncheck')
  dom.innerHTML = `
  <div class='dropdowncheck-box'><span class='dropdowncheck-name'></span> <i class='material-icons'>arrow_drop_down</i></div>
  <div class='dropdowncheck-dropdown'>
    <input class='filter' type='text' placeholder='Filter...' />
    <small class='status'>&nbsp;</small>
  </div>
  `
  
  dom.querySelector('.dropdowncheck-name').textContent = name
  
  dom.querySelector('.filter').addEventListener('keyup', (function(e){
    let text = e.target.value.trim().toLowerCase()
    let items = Array.from(this.dom.querySelectorAll('.dropdowncheck-item'))
    if(text == '') {
      items.forEach(item => item.style.display = 'flex')
    } else {
      items.forEach(function(item){
        if(item.dataset.name.toLowerCase().indexOf(text) > -1){
          item.style.display = 'flex'
        } else {
          item.style.display = 'none'
        }
      })
    }
  }).bind(this))
  
  this.name = name
  this.items = items
  this._onChange = function(e){
    let checked = e.target.checked
    let value = e.target.value
    
    if(this.cb) this.cb(value, checked, e.target)
  }
  
  let domItems = dom.querySelector('.dropdowncheck-dropdown')
  for(let item of items){
    let domItem = document.createElement('label')
    domItem.classList.add('dropdowncheck-item')
    domItem.dataset.value = item.value
    domItem.dataset.name = item.name
    let check = document.createElement('input')
    check.type = 'checkbox'
    check.value = item.value
    check.classList.add('dropdowncheck-check')
    check.addEventListener('change', this._onChange.bind(this))
    let checkContainer = document.createElement('div')
    checkContainer.classList.add('dropdowncheck-check-container')
    checkContainer.appendChild(check)
    domItem.appendChild(checkContainer)
    
    
    let span = document.createElement('span')
    span.textContent = item.name
    domItem.appendChild(span)
    domItem.setAttribute('title', item.name)
    domItems.appendChild(domItem)
  }
  
  let domBox = dom.querySelector('.dropdowncheck-box')
  domBox.addEventListener('click', (function(){
    this.dom.classList.toggle('active')
  }).bind(this))
  
  this.setEnabled = function(enabled) {
    Array.from(this.dom.querySelectorAll('input')).forEach(item => item.disabled = !enabled)
  }
  
  this.setStatus = function(status){
    if(status == "") this.dom.querySelector('small.status').innerHTML = "&nbsp;"
    else this.dom.querySelector('small.status').textContent = status
  }
  
  this.set = function(item, value) {
    this.dom.querySelector(`[value="${item}"]`).checked = value
  }
  
  this.dom = dom
}