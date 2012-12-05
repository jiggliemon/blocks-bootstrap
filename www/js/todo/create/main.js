var block = require('blocks/block')
var tmpl = require('text!../tmpl/create.tmpl')
var lang = require('i18n!../nls/todo')

var TodoCreate = block.create({
   template:tmpl
  ,lang: lang
  ,events: {
    'create-item':{
      "submit": function (e) {
        e.preventDefault()
      }
    }
  }
}, {

})

module.exports = TodoCreate