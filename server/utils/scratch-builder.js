var CronJob = require('cron').CronJob;

function init(){
  new CronJob('0 0 0 * * 6', function() {
    // clear prepared zip downloads
  }, null, true, 'America/New_York');
}

function prepare(coll, options) {
  // do some scratch stuff
  return "name of prepared zip"
}

module.exports = {
  init,
  prepare
}