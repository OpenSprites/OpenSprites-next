const resources = require('./resources')
const ajax = require('axios')

let selectedCategory = 'Resource'

async function doFetch() {
  let text = document.querySelector('.search .search-bar').value
  let searchResults = document.querySelector('.search .search-results')
  
  text = text.trim()
  if(text.length == 0) return
  try {
    searchResults.innerHTML = "Searching..."
    let res = await ajax.post('/search', { q: text, category: selectedCategory, csrf: window.csrf })
    searchResults.innerHTML = res.data
    resources.parse()
  } catch(e) {
    console.log(e)
    searchResults.innerHTML = "Error"
  }
}

// debounce
let timeout
function fetchSearch() {
  clearTimeout(timeout)
  
  timeout = setTimeout(doFetch, 500)
}

module.exports = function(){
  let searchBar = document.querySelector('.search .search-bar')
  
  Array.from(document.querySelectorAll('.search-tab')).forEach(function(item) {
    item.addEventListener('click', function() {
      Array.from(document.querySelectorAll('.search-tab.selected')).forEach(e => e.classList.remove('selected'))
      this.classList.add('selected')
      selectedCategory = this.dataset.category
      clearTimeout(timeout)
      doFetch()
    })
  })
  
  searchBar.addEventListener('keyup', function(){
    fetchSearch()
  })
  
  // in case user hit back button and chrome refilled the input box
  fetchSearch()
}