module.exports = function(bindTo, method) {
  let params = []
  for(let i = 2; i < arguments.length; i++){
    params.push(arguments[i])
  }
  return new Promise((function(bindTo, method, params, resolve, reject) {
    params.push(function(err, result){
      if(err) reject(err)
      else resolve(result)
    })
    method.apply(bindTo, params)
  }).bind(this, bindTo, method, params))
}