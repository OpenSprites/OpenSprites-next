/**
 * js/template.js
 * --------------
 *
 * Barebone HTML templating system.
 */

module.exports = function(template) {
  const tmpl = Array.from(document.getElementsByClassName('template'))
    .filter(el => el.dataset.templateId === template)[0]
    .cloneNode(true)

  tmpl.classList.remove('template')
  return tmpl
}
