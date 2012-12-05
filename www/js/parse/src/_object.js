console.log('Here')
var _ = require('lodash')
var core = require('./core')
var Relation = require('./relation')
var Error = require('./error')
var Events = require('./events')
var ACL = require('./acl')
var Op = require('./op')



/**
 * Creates a new model with defined attributes. A client id (cid) is
 * automatically generated and assigned for you.
 *
 * <p>You won't normally call this method directly.  It is recommended that
 * you use a subclass of <code>Obj</code> instead, created by calling
 * <code>extend</code>.<p>
 *
 * <p>However, if you don't want to use a subclass, or aren't sure which
 * subclass is appropriate, you can use this form:<pre>
 *     var object = new Obj("ClassName");
 * </pre>
 * That is basically equivalent to:<pre>
 *     var MyClass = Obj.extend("ClassName");
 *     var object = new MyClass();
 * </pre></p>
 *
 * @param {Obj} attributes The initial set of data to store in the object.
 * @param {Obj} options A set of Backbone-like options for creating the
 *     object.  The only option currently supported is "collection".
 * @see Obj.extend
 *
 * @class
 *
 * <p>The fundamental unit of Parse data, which implements the Backbone Model
 * interface.</p>
 */
var Obj = function (attributes, options) {
  var self = this
  // Allow new Obj("ClassName") as a shortcut to _create.
  if (typeof attributes == 'string') {
    return Obj._create.apply(self, arguments);
  }

  attributes = attributes || {};
  if (options && options.parse) {
    attributes = self.parse(attributes);
  }

  var defaults = core._getValue(self, 'defaults');
  if (defaults) {
    attributes = _.extend({}, defaults, attributes);
  }

  if (options && options.collection) {
    self.collection = options.collection;
  }

  self._serverData = {};  // The last known data for this object from cloud.
  self._opSetQueue = [{}];  // List of sets of changes to the data.
  self.attributes = {};  // The best estimate of this's current data.

  self._hashedJSON = {};  // Hash of values of containers at last save.
  self._escapedAttributes = {};
  self.cid = _.uniqueId('c');
  self.changed = {};
  self._silent = {};
  self._pending = {};
  if (!self.set(attributes, {silent: true})) {
    throw new Error("Can't create an invalid Obj");
  }
  self.changed = {};
  self._silent = {};
  self._pending = {};
  self._hasData = true;
  self._previousAttributes = _.clone(self.attributes);
  self.initialize.apply(self, arguments);
}

/**
 * Internal function for saveAll.  This calls func on every item in list,
 * and adds the results to results.  When it's done, optionsOrCallback is
 * called with the accumulated results.  See saveAll for more info.
 *
 * @param list - A list of Obj.
 * @param func - function (Obj, callback);
 * @param results - List of results.  Should be [] for non-recursion.
 * @param optionsOrCallback - See saveAll.
 */
var _doAll = function (list, func, results, optionsOrCallback) {
  results = results || []
  var options
  if (typeof optionsOrCallback == 'function') {
    var callback = optionsOrCallback
    options = {
       success: function (list) { 
        callback(list, null) 
      }
      ,error: function (e) { 
        callback(null, e) 
      }
    }
  } else {
    options = optionsOrCallback
  }

  if (list.length) {
    var oldOptions = options
    var newOptions = options ? _.clone(options) : {}
    newOptions.success = function (model, response) {
      results.push(model);
      _doAll(_.rest(list), func, results, oldOptions)
    }
    func.call(this, _.first(list), newOptions)
  } else {
    if (options.success) {
      options.success(results)
    }
  }
}

/**
 * Saves the given list of Obj.
 * If any error is encountered, stops and calls the error handler.
 * There are two ways you can call this function.
 *
 * The Backbone way:<pre>
 *   Obj.saveAll([object1, object2, ...], {
 *     success: function (list) {
 *       // All the objects were saved.
 *     },
 *     error: function (error) {
 *       // An error occurred while saving one of the objects.
 *     },
 *   });
 * </pre>
 * A simplified syntax:<pre>
 *   Obj.saveAll([object1, object2, ...], function (list, error) {
 *     if (list) {
 *       // All the objects were saved.
 *     } else {
 *       // An error occurred.
 *     }
 *   });
 * </pre>
 *
 * @param {Array} list A list of <code>Obj</code>.
 * @param {Obj} optionsOrCallback A Backbone-style callback object.
 */
Obj.saveAll = function (list, optionsOrCallback) {
  _doAll(list, function (obj, options) {
    obj.save(null, options)
  }, [], optionsOrCallback)
}

Obj._signUpAll = function (list, optionsOrCallback) {
    _doAll(list, function (obj, options) {
      obj.signUp(null, options);
    }, [], optionsOrCallback);
};

// Attach all inheritable methods to the Obj prototype.
_.extend(Obj.prototype, Events,
         /** @lends Obj.prototype */ {
  _existed: false,

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  initialize: function (){},

  /**
   * Returns a JSON version of the object suitable for saving to Parse.
   * @return {Obj}
   */
  toJSON: function () {
    var json = this._toFullJSON()
    _.each(["__type", "className"],
           function (key) { delete json[key] })
    return json
  },

  _toFullJSON: function (seenObjs) {
    var self = this
    var json = _.clone(self.attributes)
    
    core._each(json, function (val, key) {
      json[key] = core._encode(val, seenObjs)
    })

    core._each(self._operations, function (val, key) {
      json[key] = val
    })

    if (_.has(self, "id")) {
      json.objectId = self.id
    }

    if (_.has(self, "createdAt")) {
      if (_.isDate(self.createdAt)) {
        json.createdAt = self.createdAt.toJSON()
      } else {
        json.createdAt = self.createdAt
      }
    }

    if (_.has(self, "updatedAt")) {
      if (_.isDate(self.updatedAt)) {
        json.updatedAt = self.updatedAt.toJSON()
      } else {
        json.updatedAt = self.updatedAt
      }
    }
    json.__type = "Obj";
    json.className = self.className
    return json
  },

  /**
   * Updates _hashedJSON to reflect the current state of this object.
   * Adds any changed hash values to the set of pending changes.
   */
  _refreshCache: function () {
    var self = this
    core._each(self.attributes, function (value, key) {
      if (value instanceof Obj) {
        value._refreshCache()
      } else if (_.isObject(value)) {
        if (self._resetCacheForKey(key)) {
          self.set(key, new Op.Set(value), { silent: true })
        }
      }
    })
  },

  /**
   * Returns true if this object has been modified since its last
   * save/refresh.  If an attribute is specified, it returns true only if that
   * particular attribute has been modified since the last save/refresh.
   * @param {String} attr An attribute name (optional).
   * @return {Boolean}
   */
  dirty: function (attr) {
    this._refreshCache()

    var currentChanges = _.last(this._opSetQueue)

    if (attr) {
      return (currentChanges[attr] ? true : false)
    }

    if (!this.id) {
      return true
    }

    if (_.keys(currentChanges).length > 0) {
      return true
    }
    return false
  },

  /**
   * Gets a Pointer referencing this Obj.
   */
  _toPointer: function () {
    if (!this.id) {
      throw new Error("Can't serialize an unsaved Obj")
    }

    return { __type: "Pointer",
             className: this.className,
             objectId: this.id }
  },

  /**
   * Gets the value of an attribute.
   * @param {String} attr The string name of an attribute.
   */
  get: function (attr) {
    return this.attributes[attr]
  },

  /**
   * Gets a relation on the given class for the attribute.
   * @param String attr The attribute to get the relation for.
   */
  relation: function (attr) {
    var value = this.get(attr);
    if (value) {
      if (!(value instanceof Relation)) {
        throw "Called relation() on non-relation field " + attr
      }

      value._ensureParentAndKey(this, attr)
      return value;
    } else {
      return new Relation(this, attr)
    }
  },

  /**
   * Gets the HTML-escaped value of an attribute.
   */
  escape: function (attr) {
    var html = this._escapedAttributes[attr]
    if (html) {
      return html
    }
    var val = this.attributes[attr]
    var escaped;
    if (core._isNullOrUndefined(val)) {
      escaped = ''
    } else {
      escaped = _.escape(val.toString())
    }
    this._escapedAttributes[attr] = escaped
    return escaped
  },

  /**
   * Returns <code>true</code> if the attribute contains a value that is not
   * null or undefined.
   * @param {String} attr The string name of the attribute.
   * @return {Boolean}
   */
  has: function (attr) {
    return !core._isNullOrUndefined(this.attributes[attr])
  },

  /**
   * Pulls "special" fields like objectId, createdAt, etc. out of attrs
   * and puts them on "this" directly.  Removes them from attrs.
   * @param attrs - A dictionary with the data for this Obj.
   */
  _mergeMagicFields: function (attrs) {
    // Check for changes of magic fields.
    var model = this
    _.each(["id", "objectId", "createdAt", "updatedAt"], function (attr) {
      if (attrs[attr]) {
        if (attr === "objectId") {
          model.id = attrs[attr]
        } else if ((attr === "createdAt" || attr === "updatedAt") &&
                   !_.isDate(attrs[attr])) {
          model[attr] = core._parseDate(attrs[attr])
        } else {
          model[attr] = attrs[attr]
        }
        delete attrs[attr]
      }
    })
  },

  /**
   * Returns the json to be sent to the server.
   */
  _startSave: function () {
    this._opSetQueue.push({})
  },

  /**
   * If any save has been started since the current one running, process the
   * next one in the queue.
   */
  _processSaveQueue: function () {
    var self = this
    if (self._saveQueue && self._saveQueue.length > 0) {
      var nextSave = _.first(self._saveQueue)
      self._saveQueue = _.rest(self._saveQueue)
      nextSave()
    } else {
      self._saving = false
    }
  },

  /**
   * Called when a save fails because of an error. Any changes that were part
   * of the save need to be merged with changes made after the save. This
   * might throw an exception is you do conflicting operations. For example,
   * if you do:
   *   object.set("foo", "bar");
   *   object.set("invalid field name", "baz");
   *   object.save();
   *   object.increment("foo");
   * then this will throw when the save fails and the client tries to merge
   * "bar" with the +1.
   */
  _cancelSave: function () {
    var self = this
    var failedChanges = _.first(self._opSetQueue)
    self._opSetQueue = _.rest(self._opSetQueue)
    var nextChanges = _.first(self._opSetQueue)
    core._each(failedChanges, function (op, key) {
      var op1 = failedChanges[key]
      var op2 = nextChanges[key]
      if (op1 && op2) {
        nextChanges[key] = op2._mergeWithPrevious(op1)
      } else if (op1) {
        nextChanges[key] = op1
      }
    })
    self._processSaveQueue()
  },

  /**
   * Called when a save completes successfully. This merges the changes that
   * were saved into the known server data, and overrides it with any data
   * sent directly from the server.
   */
  _finishSave: function (serverData) {
    var self = this
    var savedChanges = _.first(self._opSetQueue)
    self._opSetQueue = _.rest(self._opSetQueue)
    self._applyOpSet(savedChanges, self._serverData)
    self._mergeMagicFields(serverData)
    
    core._each(serverData, function (value, key) {
      self._serverData[key] = core._decode(key, value)
    })
    self._rebuildAllEstimatedData()
    self._processSaveQueue()
  },

  /**
   * Called when a fetch or login is complete to set the known server data to
   * the given object.
   */
  _finishFetch: function (serverData, hasData) {
    var self = this
    // Clear out any changes the user might have made previously.
    self._opSetQueue = [{}]

    // Bring in all the new server data.
    self._mergeMagicFields(serverData)

    core._each(serverData, function (value, key) {
      self._serverData[key] = core._decode(key, value)
    })

    // Refresh the attributes.
    self._rebuildAllEstimatedData()

    // Clear out the cache of mutable containers.
    self._refreshCache()
    self._opSetQueue = [{}]

    self._hasData = hasData
  },

  /**
   * Applies the set of Parse.Op in opSet to the object target.
   */
  _applyOpSet: function (opSet, target) {
    var self = this
    _.each(opSet, function (change, key) {
      target[key] = change._estimate(target[key], self, key)
      if (target[key] === Op._UNSET) {
        delete target[key]
      }
    })
  },

  /**
   * Replaces the cached value for key with the current value.
   * Returns true if the new value is different than the old value.
   */
  _resetCacheForKey: function (key) {
    var value = this.attributes[key]
    if (_.isObject(value) && !(value instanceof Obj)) {
      value = value.toJSON ? value.toJSON() : value
      var json = JSON.stringify(value)
      if (this._hashedJSON[key] !== json) {
        this._hashedJSON[key] = json
        return true
      }
    }
    return false
  },

  /**
   * Populates attributes[key] by starting with the last known data from the
   * server, and applying all of the local changes that have been made to that
   * key since then.
   */
  _rebuildEstimatedDataForKey: function (key) {
    var self = this
    delete self.attributes[key]
    if (self._serverData[key]) {
      self.attributes[key] = self._serverData[key]
    }
    _.each(self._opSetQueue, function (opSet) {
      var op = opSet[key]
      if (op) {
        self.attributes[key] = op._estimate(self.attributes[key], self, key)
        if (self.attributes[key] === Op._UNSET) {
          delete self.attributes[key]
        } else {
          self._resetCacheForKey(key)
        }
      }
    })
  },

  /**
   * Populates attributes by starting with the last known data from the
   * server, and applying all of the local changes that have been made since
   * then.
   */
  _rebuildAllEstimatedData: function () {
    var self = this
    self.attributes = _.clone(self._serverData)
    _.each(self._opSetQueue, function (opSet) {
      self._applyOpSet(opSet, self.attributes)
      _.each(opSet, function (op, key) {
        self._resetCacheForKey(key)
      })
    })
  },

  /**
   * Sets a hash of model attributes on the object, firing
   * <code>"change"</code> unless you choose to silence it.
   *
   * <p>You can call it with an object containing keys and values, or with one
   * key and value.  For example:<pre>
   *   gameTurn.set({
   *     player: player1,
   *     diceRoll: 2
   *   }, {
   *     error: function (gameTurnAgain, error) {
   *       // The set failed validation.
   *     }
   *   });
   *
   *   game.set("currentPlayer", player2, {
   *     error: function (gameTurnAgain, error) {
   *       // The set failed validation.
   *     }
   *   });
   *
   *   game.set("finished", true);</pre></p>
   * 
   * @param {String} key The key to set.
   * @param {} value The value to give it.
   * @param {Obj} options A set of Backbone-like options for the set.
   *     The only supported options are <code>silent</code> and
   *     <code>error</code>.
   * @return {Boolean} true if the set succeeded.
   * @see Obj#validate
   * @see Error
   */
  set: function (key, value, options) {
    var attrs, attr
    if (_.isObject(key) || core._isNullOrUndefined(key)) {
      attrs = key
      core._each(attrs, function (v, k) {
        attrs[k] = core._decode(k, v)
      })
      options = value
    } else {
      attrs = {}
      attrs[key] = core._decode(key, value)
    }

    // Extract attributes and options.
    options = options || {}
    if (!attrs) {
      return this
    }
    if (attrs instanceof Obj) {
      attrs = attrs.attributes
    }

    // If the unset option is used, every attribute should be a Unset.
    if (options.unset) {
      core._each(attrs, function (unused_value, key) {
        attrs[key] = new Op.Unset()
      })
    }

    // Apply all the attributes to get the estimated values.
    var dataToValidate = _.clone(attrs)
    var self = this;
    core._each(dataToValidate, function (value, key) {
      if (value instanceof Op) {
        dataToValidate[key] = value._estimate(self.attributes[key],
                                              self, key)
        if (dataToValidate[key] === Op._UNSET) {
          delete dataToValidate[key]
        }
      }
    })

    // Run validation. 
    if (!this._validate(attrs, options)) {
      return false
    }

    this._mergeMagicFields(attrs)

    options.changes = {}
    var escaped = this._escapedAttributes
    var prev = this._previousAttributes || {}

    // Update attributes.
    core._each(_.keys(attrs), function (attr) {
      var val = attrs[attr]

      // If this is a relation object we need to set the parent correctly,
      // since the location where it was parsed does not have access to
      // this object.
      if (val instanceof Relation) {
        val.parent = self
      }

      if (!(val instanceof Op)) {
        val = new Op.Set(val)
      }

      // See if this change will actually have any effect.
      var isRealChange = true
      if (val instanceof Op.Set &&
          _.isEqual(self.attributes[attr], val.value)) {
        isRealChange = false
      }

      if (isRealChange) {
        delete escaped[attr]
        if (options.silent) {
          self._silent[attr] = true
        } else {
          options.changes[attr] = true
        }
      }

      var currentChanges = _.last(self._opSetQueue)
      currentChanges[attr] = val._mergeWithPrevious(currentChanges[attr])
      self._rebuildEstimatedDataForKey(attr)

      if (isRealChange) {
        self.changed[attr] = self.attributes[attr]
        if (!options.silent) {
          self._pending[attr] = true
        }
      } else {
        delete self.changed[attr]
        delete self._pending[attr]
      }
    });

    if (!options.silent) {
      this.change(options)
    }
    return this
  },

  /**
   * Remove an attribute from the model, firing <code>"change"</code> unless
   * you choose to silence it. This is a noop if the attribute doesn't
   * exist.
   */
  unset: function (attr, options) {
    options = options || {}
    options.unset = true
    return this.set(attr, null, options)
  },

  /**
   * Atomically increments the value of the given attribute the next time the
   * object is saved. If no amount is specified, 1 is used by default.
   *
   * @param attr {String} The key.
   * @param amount {Number} The amount to increment by.
   */
  increment: function (attr, amount) {
    if (core._isNullOrUndefined(amount)) {
      amount = 1
    }
    return this.set(attr, new Op.Increment(amount))
  },

  /**
   * Atomically add an object to the end of the array associated with a given
   * key.
   * @param attr {String} The key.
   * @param item {} The item to add.
   */
  add: function (attr, item) {
    return this.set(attr, new Op.Add([item]))
  },

  /**
   * Atomically add an object to the array associated with a given key, only
   * if it is not already present in the array. The position of the insert is
   * not guaranteed.
   *
   * @param attr {String} The key.
   * @param item {} The object to add.
   */
  addUnique: function (attr, item) {
    return this.set(attr, new Op.AddUnique([item]))
  },

  /**
   * Atomically remove all instances of an object from the array associated
   * with a given key.
   *
   * @param attr {String} The key.
   * @param item {} The object to remove.
   */
  remove: function (attr, item) {
    return this.set(attr, new Op.Remove([item]))
  },

  /**
   * Returns an instance of a subclass of Parse.Op describing what kind of
   * modification has been performed on this field since the last time it was
   * saved. For example, after calling object.increment("x"), calling
   * object.op("x") would return an instance of Parse.Op.Increment.
   *
   * @param attr {String} The key.
   * @returns {Parse.Op} The operation, or undefined if none.
   */
  op: function (attr) {
    return _.last(this._opSetQueue)[attr]
  },

  /**
   * Clear all attributes on the model, firing <code>"change"</code> unless
   * you choose to silence it.
   */
  clear: function (options) {
    options = options || {}
    options.unset = true
    var keysToClear = _.extend(this.attributes, this._operations)
    return this.set(keysToClear, options)
  },

  /**
   * Returns a JSON-encoded set of operations to be sent with the next save
   * request.
   */
  _getSaveJSON: function () {
    var json = _.clone(_.first(this._opSetQueue))
    core._each(json, function (op, key) {
      json[key] = op.toJSON()
    })
    return json
  },

  /**
   * Fetch the model from the server. If the server's representation of the
   * model differs from its current attributes, they will be overriden,
   * triggering a <code>"change"</code> event.
   */
  fetch: function (options) {
    options = options ? _.clone(options) : {}
    var model = this
    var success = options.success
    options.success = function (resp, status, xhr) {
      model._finishFetch(model.parse(resp, status, xhr), true)
      if (success) {
        success(model, resp)
      }
    };
    options.error = Obj._wrapError(options.error, model, options)
    core._request("classes", model.className, model.id, 'GET', null, options)
  },

  /**
   * Set a hash of model attributes, and save the model to the server.
   * updatedAt will be updated when the request returns.
   * You can either call it as:<pre>
   *   object.save();</pre>
   * or<pre>
   *   object.save(null, options);</pre>
   * or<pre>
   *   object.save(attrs, options);</pre>
   * or<pre>
   *   object.save(key, value, options);</pre>
   *
   * For example, <pre>
   *   gameTurn.save({
   *     player: "Jake Cutter",
   *     diceRoll: 2
   *   }, {
   *     success: function (gameTurnAgain) {
   *       // The save was successful.
   *     },
   *     error: function (gameTurnAgain, error) {
   *       // The save failed.  Error is an instance of Error.
   *     }
   *   });</pre>
   * 
   * @see Error
   */
  save: function (arg1, arg2, arg3) {
    var i, attrs, current, options, saved
    if (_.isObject(arg1) || core._isNullOrUndefined(arg1)) {
      attrs = arg1
      options = arg2
    } else {
      attrs = {}
      attrs[arg1] = arg2
      options = arg3
    }
    

    // Make save({ success: function () {} }) work.
    if (!options && attrs) {
      var extra_keys = _.reject(attrs, function (value, key) {
        return _.include(["success", "error", "wait"], key)
      })

      if (extra_keys.length === 0) {
        var all_functions = true
        if (_.has(attrs, "success") && !_.isFunction(attrs.success)) {
          all_functions = false
        }
        if (_.has(attrs, "error") && !_.isFunction(attrs.error)) {
          all_functions = false
        }
        if (all_functions) {
          // This attrs object looks like it's really an options object,
          // and there's no other options object, so let's just use it.
          return this.save(null, attrs)
        }
      }
    }

    options = options ? _.clone(options) : {}
    if (options.wait) {
      current = _.clone(this.attributes)
    }

    var silentOptions = _.extend({}, options, {silent: true})
    if (attrs && !this.set(attrs, options.wait ? silentOptions : options)) {
      return false
    }
    var oldOptions = options  // Psuedonym more accurate in some contexts.
    var newOptions = _.clone(options)

    var model = this

    // If there is any unsaved child, save it first.
    model._refreshCache();
    var unsavedChildren = Obj._findUnsavedChildren(model.attributes)

    if (unsavedChildren.length > 0) {
      Obj.saveAll(unsavedChildren, {
        success: function (results) {
          model.save(null, oldOptions)
        },
        error: function (error) {
          if (options.error) {
            options.error.apply(this, arguments)
          }
        }
      })
      return this
    }

    /** ignore */
    newOptions.success = function (resp, status, xhr) {
      var serverAttrs = model.parse(resp, status, xhr)
      if (newOptions.wait) {
        serverAttrs = _.extend(attrs || {}, serverAttrs)
      }

      model._finishSave(serverAttrs)

      if (oldOptions.success) {
        oldOptions.success(model, resp)
      } else {
        model.trigger('sync', model, resp, newOptions)
      }
    };

    newOptions.error = function () {
      model._cancelSave()
      if (oldOptions.error) {
        oldOptions.error.apply(this, arguments)
      }
    };

    newOptions.error = Obj._wrapError(newOptions.error, model, newOptions)

    this._startSave()

    var doSave = function () {
      var method = model.id ? 'PUT' : 'POST'

      var json = model._getSaveJSON()
      
      var route = "classes"
      var className = model.className
      if (model.className === "_User" && !model.id) {
        // Special-case user sign-up.
        route = "users"
        className = null
      }
      core._request(route, className, model.id, method, json, newOptions)
      if (newOptions.wait) {
        model.set(current, silentOptions)
      }
    }

    if (this._saving) {
      this._saveQueue = this._saveQueue || []
      this._saveQueue.push(doSave)
    } else {
      this._saving = true
      doSave()
    }
    console.log('Finished Save')
    return this
  },

  /**
   * Destroy this model on the server if it was already persisted.
   * Optimistically removes the model from its collection, if it has one.
   * If `wait: true` is passed, waits for the server to respond
   * before removal.
   */
  destroy: function (options) {
    options = options ? _.clone(options) : {}
    var model = this
    var success = options.success

    var triggerDestroy = function () {
      model.trigger('destroy', model, model.collection, options)
    }

    if (!this.id) {
      return triggerDestroy()
    }
    /** ignore */
    options.success = function (resp) {
      if (options.wait) {
        triggerDestroy()
      }
      if (success) {
        success(model, resp)
      } else {
        model.trigger('sync', model, resp, options)
      }
    }
    options.error = Obj._wrapError(options.error, model, options)

    core._request("classes", this.className, this.id, 'DELETE', null, options)
    if (!options.wait) {
      triggerDestroy()
    }
  },

  /**
   * Converts a response into the hash of attributes to be set on the model.
   * @ignore
   */
  parse: function (resp, status, xhr) {
    var output = _.clone(resp)
    _(["createdAt", "updatedAt"]).each(function (key) {
      if (output[key]) {
        output[key] = core._parseDate(output[key])
      }
    })
    if (!output.updatedAt) {
      output.updatedAt = output.createdAt
    }
    if (status) {
      this._existed = (status.status !== 201)
    }
    return output
  },

  /**
   * Creates a new model with identical attributes to this one.
   * @return {Obj}
   */
  clone: function () {
    return new this.constructor(this.attributes)
  },

  /**
   * Returns true if this object has never been saved to Parse.
   * @return {Boolean}
   */
  isNew: function () {
    return !this.id
  },

  /**
   * Call this method to manually fire a `"change"` event for this model and
   * a `"change:attribute"` event for each changed attribute.
   * Calling this will cause all objects observing the model to update.
   */
  change: function (options) {
    options = options || {};
    var changing = this._changing
    this._changing = true

    // Silent changes become pending changes.
    var self = this
    core._each(this._silent, function (attr) {
      self._pending[attr] = true
    })

    // Silent changes are triggered.
    var changes = _.extend({}, options.changes, this._silent)
    this._silent = {}
    core._each(changes, function (unused_value, attr) {
      self.trigger('change:' + attr, self, self.get(attr), options)
    })
    if (changing) {
      return this;
    }

    // This is to get around lint not letting us make a function in a loop.
    var deleteChanged = function (attr) {
      if (!self._pending[attr] && !self._silent[attr]) {
        delete self.changed[attr]
      }
    };

    // Continue firing `"change"` events while there are pending changes.
    while (!_.isEmpty(this._pending)) {
      this._pending = {}
      this.trigger('change', this, options)
      // Pending and silent changes still remain.
      core._each(this.changed, deleteChanged)
      self._previousAttributes = _.clone(this.attributes)
    }

    this._changing = false
    return this
  },

  /**
   * Returns true if this object was created by the Parse server when the
   * object might have already been there (e.g. in the case of a Facebook
   * login)
   */
  existed: function () {
    return this._existed
  },

  /**
   * Determine if the model has changed since the last <code>"change"</code>
   * event.  If you specify an attribute name, determine if that attribute
   * has changed.
   * @param {String} attr Optional attribute name
   * @return {Boolean}
   */
  hasChanged: function (attr) {
    if (!arguments.length) {
      return !_.isEmpty(this._changed)
    }
    return this._changed && _.has(this._changed, attr)
  },

  /**
   * Returns an object containing all the attributes that have changed, or
   * false if there are no changed attributes. Useful for determining what
   * parts of a view need to be updated and/or what attributes need to be
   * persisted to the server. Unset attributes will be set to undefined.
   * You can also pass an attributes object to diff against the model,
   * determining if there *would be* a change.
   */
  changedAttributes: function (diff) {
    if (!diff) {
      return this.hasChanged() ? _.clone(this._changed) : false
    }
    var changed = {}
    var old = this._previousAttributes
    core._each(diff, function (diffVal, attr) {
      if (!_.isEqual(old[attr], diffVal)) {
        changed[attr] = diffVal
      }
    })
    return changed
  },

  /**
   * Gets the previous value of an attribute, recorded at the time the last
   * <code>"change"</code> event was fired.
   * @param {String} attr Name of the attribute to get.
   */
  previous: function (attr) {
    if (!arguments.length || !this._previousAttributes) {
      return null
    }
    return this._previousAttributes[attr]
  },

  /**
   * Gets all of the attributes of the model at the time of the previous
   * <code>"change"</code> event.
   * @return {Obj}
   */
  previousAttributes: function () {
    return _.clone(this._previousAttributes)
  },

  /**
   * Checks if the model is currently in a valid state. It's only possible to
   * get into an *invalid* state if you're using silent changes.
   * @return {Boolean}
   */
  isValid: function () {
    return !this.validate(this.attributes)
  },

  /**
   * You should not call this function directly unless you subclass
   * <code>Obj</code>, in which case you can override this method
   * to provide additional validation on <code>set</code> and
   * <code>save</code>.  Your implementation should return 
   *
   * @param {Obj} attrs The current data to validate.
   * @param {Obj} options A Backbone-like options object.
   * @return {} False if the data is valid.  An error object otherwise.
   * @see Obj#set
   */
  validate: function (attrs, options) {
    if (_.has(attrs, "ACL") && !(attrs.ACL instanceof ACL)) {
      return new Error(Error.OTHER_CAUSE, "ACL must be a Parse.ACL.")
    }
    return false
  },

  /**
   * Run validation against a set of incoming attributes, returning `true`
   * if all is well. If a specific `error` callback has been passed,
   * call that instead of firing the general `"error"` event.
   */
  _validate: function (attrs, options) {
    if (options.silent || !this.validate) {
      return true
    }
    attrs = _.extend({}, this.attributes, attrs)
    var error = this.validate(attrs, options)
    if (!error) {
      return true
    }
    if (options && options.error) {
      options.error(this, error, options)
    } else {
      this.trigger('error', this, error, options)
    }
    return false
  },

  /**
   * Returns the ACL for this object.
   * @returns {Parse.ACL} An instance of Parse.ACL.
   * @see Obj#get
   */
  getACL: function () {
    return this.get("ACL")
  },

  /**
   * Sets the ACL to be used for this object.
   * @param {Parse.ACL} acl An instance of Parse.ACL.
   * @param {Obj} options Optional Backbone-like options object to be
   *     passed in to set.
   * @return {Boolean} Whether the set passed validation.
   * @see Obj#set
   */
  setACL: function (acl, options) {
    return this.set("ACL", acl, options)
  }

});

/**
 * Returns the appropriate subclass for making new instances of the given
 * className string.
 */
Obj._getSubclass = function (className) {
  if (!_.isString(className)) {
    throw "Obj._getSubclass requires a string argument."
  }
  var ObjClass = Obj._classMap[className]
  if (!ObjClass) {
    ObjClass = Obj.extend(className)
    Obj._classMap[className] = ObjClass
  }
  return ObjClass
};

/**
 * Creates an instance of a subclass of Obj for the given classname.
 */
Obj._create = function (className, attributes, options) {
  var ObjClass = Obj._getSubclass(className)
  return new ObjClass(attributes, options)
};

// Set up a map of className to class so that we can create new instances of
// Parse Objs from JSON automatically.
Obj._classMap = {}

Obj._extend = core._extend

/**
 * Creates a new subclass of Obj for the given Parse class name.
 *
 * <p>Every extension of a Parse class will inherit from the most recent
 * previous extension of that class. When a Obj is automatically
 * created by parsing JSON, it will use the most recent extension of that
 * class.</p>
 *
 * <p>You should call either:<pre>
 *     var MyClass = Obj.extend("MyClass", {
 *         <i>Instance properties</i>
 *     }, {
 *         <i>Class properties</i>
 *     });</pre>
 * or, for Backbone compatibility:<pre>
 *     var MyClass = Obj.extend({
 *         className: "MyClass",
 *         <i>Other instance properties</i>
 *     }, {
 *         <i>Class properties</i>
 *     });</pre></p>
 *
 * @param {String} className The name of the Parse class backing this model.
 * @param {Obj} protoProps Instance properties to add to instances of the
 *     class returned from this method.
 * @param {Obj} classProps Class properties to add the class returned from
 *     this method.
 * @return {Class} A new subclass of Obj.
 */
Obj.extend = function (className, protoProps, classProps) {
  // Handle the case with only two args.
  if (!_.isString(className)) {
    if (className && _.has(className, "className")) {
      return Obj.extend(className.className, className, protoProps)
    } else {
      throw new Error(
          "Obj.extend's first argument should be the className.")
    }
  }

  // If someone tries to subclass "User", coerce it to the right type.
  if (className === "User") {
    className = "_User"
  }

  var NewClassObj = null;
  if (_.has(Obj._classMap, className)) {
    var OldClassObj = Obj._classMap[className]
    // This new subclass has been told to extend both from "this" and from
    // OldClassObj. This is multiple inheritance, which isn't supported.
    // For now, let's just pick one.
    NewClassObj = OldClassObj._extend(protoProps, classProps)
  } else {
    protoProps = protoProps || {}
    protoProps.className = className
    NewClassObj = this._extend(protoProps, classProps)
  }
  // Extending a subclass should reuse the classname automatically.
  NewClassObj.extend = function (arg0) {
    if (_.isString(arg0) || (arg0 && _.has(arg0, "className"))) {
      return Obj.extend.apply(NewClassObj, arguments)
    }
    var newArguments = [className].concat(_.toArray(arguments))
    return Obj.extend.apply(NewClassObj, newArguments)
  }
  Obj._classMap[className] = NewClassObj
  return NewClassObj
};

/**
 * Wrap an optional error callback with a fallback error event.
 */
Obj._wrapError = function (onError, originalModel, options) {
  return function (model, response) {
    if (model !== originalModel) {
      response = model;
    }
    var error = new Error(-1, response.responseText)
    if (response.responseText) {
      var errorJSON = JSON.parse(response.responseText)
      if (errorJSON) {
        error = new Error(errorJSON.code, errorJSON.error)
      }
    }
    if (onError) {
      onError(originalModel, error, options)
    } else {
      originalModel.trigger('error', originalModel, error, options)
    }
  };
};

Obj._findUnsavedChildren = function (object) {

  var results = [];

  if (object instanceof Obj) {
    object._refreshCache()
    if (object.dirty()) {
      results = [object]
    }
    results.push.apply(results,
                       Obj._findUnsavedChildren(object.attributes))
  } else if (object instanceof Relation) {
    // Nothing needs to be done, but we don't want to recurse into the
    // relation's parent infinitely, so we catch this case.
    var unused = null
  } else if (_.isArray(object)) {
    _.each(object, function (child) {
      results.push.apply(results, Obj._findUnsavedChildren(child))
    });
  } else if (_.isObject(object)) {
    core._each(object, function (child) {
      results.push.apply(results, Obj._findUnsavedChildren(child))
    })
  }
  return results
};

module.exports = Obj