'use strict'
const path = require('path')

function resolve(dir) {
  return path.join(__dirname, dir)
}

module.exports = {
  outputDir: 'dist',
  assetsDir: 'static',
}
