let safeSites = ["opensprites.org", "scratch.mit.edu", "localhost"]
let redirects = [
  {
    match: 'youtube.com',
    pathRegex: /watch\?v=([^&]+)/,
    replace: 'https://scratch.mit.edu/discuss/youtube/{1}'
  },
  {
    match: 'youtu.be',
    pathRegex: /[^\/\?]+/,
    replace: 'https://scratch.mit.edu/discuss/youtube/{0}'
  }
]

document.querySelector(".os-leaving-continue").addEventListener("click", function(){
  window.open(this.dataset.siteurl)
})

document.querySelector(".os-leaving-back").addEventListener("click", function(){
  document.querySelector(".os-leaving").classList.remove("active")
})

function displayDialog(siteurl) {
  let leaving = document.querySelector(".os-leaving")
  leaving.querySelector(".os-leaving-url").textContent = siteurl
  leaving.querySelector(".os-leaving-continue").dataset.siteurl = siteurl
  leaving.classList.add("active")
}

function doReplace(hostname, path) {
  for(let redir of redirects) {
    if(hostname.endsWith(redir.match)) {
      let match = redir.pathRegex.exec(path)
      return redir.replace.replace(/{(\d+)}/g, function(m, p1){
        return match[parseInt(p1)]
      })
    }
  }
  return false
}

module.exports = function(siteurl){
  let l = document.createElement("a")
  l.href = siteurl
  
  let hostname = l.hostname
  let pathname = l.pathname + l.search
  let replace = doReplace(hostname, pathname)
  if(replace) {
    window.open(replace)
    return false
  }
  
  for(let site of safeSites){
    if(hostname.endsWith(site))
      return true
  }
  
  displayDialog(siteurl)
  return false
}