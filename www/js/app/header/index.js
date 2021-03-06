var block = require('blocks/block')
var tmpl = require('text!./tmpl/index.tmpl')

var hasClass = false

var header = block.begets({
  template: tmpl
  ,events: {
    "brand": {
      "mouseover,mouseout": function (e, self) {
        e.preventDefault()
        self.doSomething()
      }
      ,"click": function (e, self) {
        e.preventDefault()
        hasClass = !hasClass
        this.classList[hasClass?'add':'remove']('active')
      }
    }
  }
}, {

  doSomething: function () {
    console.log('hello')
  }

})

module.exports = header