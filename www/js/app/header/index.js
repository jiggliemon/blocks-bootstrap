var block = require('blocks/block')
var tmpl = require('text!./tmpl/index.tmpl')

var header = new block('header', {
  template: tmpl
})

module.exports = header