module.exports = function(){
  document.querySelector('.collection-ui.controls .display-switch').addEventListener('click', function(){
    let container = document.querySelector('.resource-container')
    if(container.classList.contains('display-tiles')) {
      container.classList.remove('display-tiles')
      container.classList.add('display-list')
      document.querySelector('.collection-ui.controls .display-switch button').textContent = 'view_list'
    } else {
      container.classList.remove('display-list')
      container.classList.add('display-tiles')
      document.querySelector('.collection-ui.controls .display-switch button').textContent = 'view_module'
    }
  });
}