const ajax = require('axios')

async function del(e) {
  let btn = e.target
  let res = btn.parentNode
  let to = btn.attributes['data-to'].value

  if(btn.attributes['data-sure']) {
    if(!window.confirm('Are you sure you\'d like to delete this?')) {
      btn.innerHTML = 'delete'
      return
    }
  }

  await ajax({
    url: to,
    method: 'delete',
    headers: {
      'X-CSRF-Token': window.csrf
    }
  })

  if(btn.attributes['data-sure']) {
    window.location.href = '/you'
  } else {
    btn.innerHTML = 'undelete'
  }
} 

async function undelete(e) {
  let btn = e.target
  let res = btn.parentNode
  let to = btn.attributes['data-to'].value

  await ajax({
    url: to,
    method: 'post',
    headers: {
      'X-CSRF-Token': window.csrf
    }
  })
  
  btn.innerHTML = 'delete'
}

module.exports = function() {
  let btns = document.querySelectorAll('.btn.admin-do')

  for(let i = 0; i < btns.length; i++) {
    let btn = btns[i]

    btn.addEventListener('click', function(e) {
      if(btn.innerText == 'delete') {
        btn.innerHTML = 'deleting...'
        del(e)
      } else {
        btn.innerHTML = 'undeleting...'
        undelete(e)
      }
    })
  }
}
