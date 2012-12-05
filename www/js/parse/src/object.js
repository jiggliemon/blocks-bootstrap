
function Obj (attrs, options) {
  var self = this

  self.initialize.apply(self,arguments)
}

Obj.prototype = {
   add: function (attr, item) {}
  ,addUnique: function (attr, item) {}
  ,change: function (options) {}
  ,changedAttributes: function (diff) {}
  ,clear: function (options) {}
  ,clone: function () {}
  ,destroy: function () {}
  ,dirty: function (attr) {}
  ,escape: function (attr) {}
  ,existed: function () {}
  ,fetch: function (options) {}
  ,get: function () {}
  ,has: function () {}
  ,hasChanged: function (attr) {}
  ,increment: function (attr, qty) {}
  ,initialize: function () {}
  ,isNew: function () {}
  ,isValid: function () {}
  ,op: function (attr) {}
  ,previous: function (attr) {}
  ,previousAttributes: function () {}
  ,relation: function () {}
  ,remove: function (attr, item) {}
  ,save: function () {}
  ,set: function () {}
  ,unset: function () {}
  ,setACL: function (acl, options) {}
  ,toJSON: function () {}
  ,validate: function () {}
}


/**
 * Static Methods 
 *
 */
Obj.extend = function (className, protoProps, classProps) {
  
  // Handle the case with only two args.
  if (!(typeof className == 'string')) {
    if (className && className.hasOwnProperty("className")) {
      return Obj.extend(className.className, className, protoProps)
    } else {
      throw new Error("Obj.extend's first argument should be the name of the class.")
    }
  }

  // If someone tries to subclass "User", coerce it to the right type.
  if (className == "User") {
    className = "_User"
  }

  var NewClassObj = null;
  if (Obj._classMap.hasOwnProperty(className)) {
    var OldClassObj = Obj._classMap[className]
    // This new subclass has been told to extend both from "this" and from
    // OldClassObj. This is multiple inheritance, which isn't supported.
    // For now, let's just pick one.
    NewClassObj = OldClassObj._extend(protoProps, classProps)
  } else {
    protoProps = protoProps || {}
    protoProps.className = className
    NewClassObj = extend(protoProps, classProps)
  }

  // Extending a subclass should reuse the classname automatically.
  NewClassObj.extend = function (arg0) {
    if ((typeof arg0 == 'string') || (arg0 && arg0.hasOwnProperty("className"))) {
      return Obj.extend.apply(NewClassObj, arguments)
    }
    var newArguments = [className].concat(Array.prototype.slice.call(arguments))
    return Obj.extend.apply(NewClassObj, newArguments)
  }
  Obj._classMap[className] = NewClassObj

  return NewClassObj
}


Obj.saveAll = function () {}

module.exports = Obj