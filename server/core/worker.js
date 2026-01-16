const path = require('path')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: true,
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('../helpers/error'),
  configSvc: require('./config')
}
global.WIKI = WIKI

WIKI.configSvc.init()
WIKI.logger = require('./logger').init('JOB')
const args = require('yargs').argv

// Debug: log database config (without password)
WIKI.logger.info(`Worker IS_MASTER: ${WIKI.IS_MASTER}`)
WIKI.logger.info(`Worker DB config - host: ${WIKI.config.db.host}, user: ${WIKI.config.db.user}, db: ${WIKI.config.db.db}, pass length: ${WIKI.config.db.pass ? WIKI.config.db.pass.length : 0}`)

;(async () => {
  try {
    await require(`../jobs/${args.job}`)(args.data)
    process.exit(0)
  } catch (e) {
    await new Promise(resolve => process.stderr.write(e.message, resolve))
    process.exit(1)
  }
})()
