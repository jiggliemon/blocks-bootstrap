var block = require('blocks/block')
var tmpl = require('text!./tmpl/layout.tmpl')

var TodoCreate = require('./create')
var TodoList = require('./list')


var TodoApp = block.create({
  template: tmpl
},{
    name: 'todo'
   ,construct: function () {
      createBlock = new TodoCreate
      this.setChild('header', createBlock)

      
      var todoListBlock = new TodoList
      this.setChild('body', todoListBlock)
      createBlock.addEvent('task.added', function (task) {
        todoListBlock.setChild('items', task)
      })
   }
  ,getName: function () {
    return this.name
  }
  ,addTask: function (task) {
    var taskList = this.getChild('body')[0]
    taskList.setChild('items',task)
  }
})

module.exports = TodoApp