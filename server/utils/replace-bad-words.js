const rot = require('rot')
const badWords = '\\o(shtyl|(\\j*?)shpx(\\j*?)|s(h|i|\\*)?p?x(vat?)?|(\\j*?)fu(v|1|y)g(\\j*?)|pe(n|@|\\*)c(cre|crq|l)?|(onq|qhzo|wnpx)?(n|@)ff(u(b|0)yr|jvcr)?|(onq|qhzo|wnpx)?(n|@)efr(u(b|0)yr|jvcr)?|onfgneq|o(v|1|y|\\*)?g?pu(r?f)?|phag|phz|(tbq?)?qnz(a|z)(vg)?|qbhpur(\\j*?)|(arj)?snt(tbg|tng)?|sevt(tra|tva|tvat)?|bzst|cvff(\\j*?)|cbea|pbpx|obyybpxf|onyyfnpx|qvpx|qvpxurnq|encr|ergneq|frk|f r k|fung|fyhg|gvg|ju(b|0)er(\\j*?)|jg(s|su|u))(f|rq)?\\o' // rot13
const badWordsRegex = new RegExp(rot(badWords, -13), 'gi')
const hasBadWords = text => text.match(badWordsRegex)
const replaceBadWords = (text, w='⋆⋆⋆⋆') => text.replace(badWordsRegex, w)

module.exports = replaceBadWords