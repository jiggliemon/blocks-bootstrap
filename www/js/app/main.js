var block = require('blocks/block')
var tmpl = require('text!./layouts/2-col-left.tmpl')


var page = new block('page', {
   template:tmpl
  ,children: {
     header: require('./header/index')
    ,left: require('./left/index')
  }
})




document.body.appendChild(page.toElement())

module.exports = page