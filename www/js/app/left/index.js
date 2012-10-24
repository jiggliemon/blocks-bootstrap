var block = require('blocks/block')
var tmpl = require('text!./tmpl/index.tmpl')

function hasClass ( el, cls ) {
  return el.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
}

function addClass ( el, cls ) {
  if ( !hasClass(el,cls) ) {
    el.className += " "+ cls
  }
}

function removeClass (el, cls ) {
  if ( hasClass(el, cls) ) {
    var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)')
    el.className = el.className.replace(reg,' ')
  }
}

function removeActive (el) {
  removeClass(el.parentNode,'active')
}

function addActive (el) {
  addClass(el.parentNode, 'active')
}

function forEach (list, fn) {
  if (!fn) {
    return
  }
  
  for ( var i = 0; i < list.length; i++ ) {
    fn(list[i])
  }
}

var left = new block('left', {
   template:tmpl
  ,events: {
    'menu-list:click': function (e) {
      var target = e.target || e.srcElement
      var menuList = this.bound('menu-list')

      /**
       *  remove the active state from all
       *  the rest of the nav items
       */
      if ( menuList ) {
        var as = menuList.querySelectorAll('a')
        if ( as ) {
          forEach( as, removeActive)
        }
      }

      if ( target.tagName == 'A' ) {
        addActive(target)
      }
    }
  }
})

module.exports = left