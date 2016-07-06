let content = `OpenSprites uses cookies. By continuing to use OpenSprites you agree to our use of cookies. For more information, see our <a href="/privacy">Privacy Policy</a>. <button class="btn" onclick="this.parentElement.style.display='none';localStorage['cookies']='true'">Got it</button>`

if(!localStorage['cookies']){
  let div = document.createElement('div')
  div.setAttribute('style', 'border-top-width: 3px; border-top-style: solid; border-top-color: rgb(101, 149, 147); position: fixed; z-index: 10; bottom: 0px; left: 0px; width: 100%; padding: 1em; font-size: 1.5em; box-sizing: border-box; display: block; background: white;')
  div.innerHTML = content
  document.body.appendChild(div)
}
