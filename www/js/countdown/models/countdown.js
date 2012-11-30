var EventsMixin = require('yeah/mixin')
var extend = require('yaul/extend')
var typeOf = require('yaul/typeOf')

function keys (obj) {
  var arr = []
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      arr.push(key)
    }  
  }
  return arr
}

function now () {
  var date = new Date()
  date.setMilliseconds(0)
  return date
}

// Thinking about making this fancier.
function obliterateDelta (seconds) {
  var secondsPer = {
       days:86400
      ,hours:3600
      ,minutes: 60
      ,seconds:1
    }
    ,outputDog = {days:0,hours:0,minutes:0,seconds:0}
      
  function extractSection ( numSecs,key ) {
    var amount = Math.floor( seconds / secondsPer[key] );
    seconds -= amount * secondsPer[key];
    return amount;
  }
  
  for (var key in outputDog) {
    if (outputDog.hasOwnProperty(key)){
      outputDog[key] = extractSection(seconds, key)
    }
  }
  
  return outputDog
}


function Countdown(date) {
  var self = this
  if ( !(self instanceof Countdown)) {
    return new Countdown(date)
  }
  self.construct.call(self,date)
}


Countdown.prototype = extend({
  construct: function (options) {
    options = options || {}
    var self = this
    var date = self.date = options.date
    var type = typeOf(date)

    if (type == 'string') {
      date = self.date = new Date(date)
      if (date == "Invalid Date") throw new Error('Invalid `Date` format provided')
    }

    self.time = self.getDelta('map')
    self.keys = keys(self.time).reverse()
    self.start()
  },

  // This method feels like it should be using
  // some recursive check for the incrimentation
  tick: function () {
    // var i = self.keys.length
    // var key, el, parent
    // while (i--) {
    //   key = self.keys[i]
    //   self.time[key]
    //   parent = self.time[self.keys[i+1]]

    // }

    this.time.seconds--
    this.fireEvent('time:changed','seconds',this.time.seconds)
      
    if (this.time.seconds <= 0 ) {
      this.time.seconds = 60
      this.time.minutes--
      this.fireEvent('time:changed', 'minutes', this.time.minutes)

      if ( this.time.minutes <= 0) {
        this.time.minutes = 60
        this.time.hours--
        this.fireEvent('time:changed','hours', this.time.hours)

        if (this.time.hours <= 0) {
          this.time.hours = 24
          this.time.days--
          this.fireEvent('time:changed','days', this.time.days)
        }
      }
    }
  },
  
  getDelta: function (what, delta) {
    var self = this
    switch (what) {
      case undefined:
        delta = delta || self.date.getTime() - now().getTime()
        return Math.floor(delta/1000)
        break;
        
      case 'map':
        return obliterateDelta(self.getDelta())
        break;
        
      default:
      console.log(self.time)
        return self.time[what] 
    }
  },
  
  stop: function () {
    clearInterval(this.interval)
  },

  start: function () {
    var self = this
    self.interval = setInterval(function () {
      self.tick()
    }, 1000)
  }
}, EventsMixin)

Countdown.pad = function zeroPad ( number, width ) {
  width -= number.toString().length;
  return String( (width > 0) ? new Array(width +(/\./.test(number)?2:1)).join('0') + number : number );
}


module.exports = Countdown