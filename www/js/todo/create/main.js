var block = require('blocks/block')
var tmpl = require('text!../tmpl/create.tmpl')

var TodoCreate = block.create({
  template:tmpl
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