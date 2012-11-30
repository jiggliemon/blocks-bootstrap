var block = require('blocks/block')
var tmpl = require('text!./tmpl/layout.tmpl')


var TodoCreate = require('./create')


var TodoApp = block.create({
  template: tmpl
  ,children: {
    header: [
      new TodoCreate
    ]
  }
},{
   name: 'todo'
  ,getName: function () {
    return this.name
  }
})

module.exports = TodoApp