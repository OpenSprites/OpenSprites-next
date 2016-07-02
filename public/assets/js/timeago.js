const o = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 1000 * 60,
  day: 24 * 60 * 1000 * 60,
  week: 7 * 24 * 60 * 1000 * 60,
  month: 30 * 24 * 60 * 1000 * 60,
  year: 365 * 24 * 60 * 1000 * 60
}

module.exports = function timeago(nd) {
  let r = Math.round,
    pl = function(v, n) {
      return n + ' ' + v + (n > 1 ? 's' : '') + ' ago'
    },
    ts = new Date().getTime() - new Date(nd).getTime(),
    ii
  let i
  for(i in o) {
    if (r(ts) < o[i]) return pl(ii || 'm', r(ts / (o[ii] || 1)))
    ii = i
  }
  return pl(i, r(ts / o[i]))
}