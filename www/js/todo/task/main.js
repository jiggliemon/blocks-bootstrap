var block = require('blocks/block')


var TaskView = block.create({
  template: tmpl
  ,events: {
    label: {
      click: function (e, self) {
        var wrapper = self.bound('wrapper')
        var checkbox = self.bound('checkbox')

        wrapper.classList[(checkbox.checked)?'add':'remove']('live')
      }
    }
  }
},{
  construct: function (data, options) {
    this.data = data
  }
  ,getTask: function () {
    return this.data.task
  }
})

module.exports = TaskView