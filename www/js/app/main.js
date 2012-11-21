var block = require('blocks/block')
var tmpl = require('text!./layouts/2-col-left.tmpl')
var header = require('./header/index')
console.log(new header)

var page = new block('page', {
   template:tmpl
  ,children: {
     header: new header
    ,left: require('./left/index')
  }
})




document.body.appendChild(page.toElement())

module.exports = page