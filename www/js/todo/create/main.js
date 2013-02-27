var block = require('blocks/block')
var tmpl = require('text!../tmpl/create.tmpl')
var lang = require('i18n!../nls/todo')
var Task = require('../blocks/task')
var number = 0

var TodoCreate = block.create({
   template:tmpl
  ,lang: lang
  ,events: {
    'create-item':{
      "submit": function (e, self) {
        e.preventDefault()
        var addItem = self.bound('add-item')
        var value = addItem.value.trim()
        if ( value ) {
          var task = new Task({task: addItem.value })
          self.fireEvent('task.added', task)
        }
      }
    }
  }
}, {
  construct: function () {
    var self = this
    self.number = number++
    console.log('constructed')
    self.addEvent('task.added', function () {
      self.bound('add-item').value = ''
    })
  }
})

module.exports = TodoCreate