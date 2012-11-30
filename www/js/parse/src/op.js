
var _ = require('lodash')
var core = require('./core')
var Obj = require('./object')
var Relation = require('./relation')
/**
 * @class
 * A Op is an atomic operation that can be applied to a field in a
 * Obj. For example, calling <code>object.set("foo", "bar")</code>
 * is an example of a Op.Set. Calling <code>object.unset("foo")</code>
 * is a Op.Unset. These operations are stored in a Obj and
 * sent to the server as part of <code>object.save()</code> operations.
 * Instances of Op should be immutable.
 *
 * You should not create subclasses of Op or instantiate Op
 * directly.
 */
var Op = function () {
  this._initialize.apply(this, arguments);
};

Op.prototype = {
  _initialize: function () {}
};

_.extend(Op, {
  /**
   * To create a new Op, call Op._extend();
   */
  _extend: core._extend,

  // A map of __op string to decoder function.
  _opDecoderMap: {},

  /**
   * Registers a function to convert a json object with an __op field into an
   * instance of a subclass of Op.
   */
  _registerDecoder: function (opName, decoder) {
    Op._opDecoderMap[opName] = decoder;
  },

  /**
   * Converts a json object into an instance of a subclass of Op.
   */
  _decode: function (json) {
    var decoder = Op._opDecoderMap[json.__op];
    if (decoder) {
      return decoder(json);
    } else {
      return undefined;
    }
  }
});

/*
 * Add a handler for Batch ops.
 */
Op._registerDecoder("Batch", function (json) {
  var op = null;
  _.each(json.ops, function (nextOp) {
    nextOp = Op._decode(nextOp);
    op = nextOp._mergeWithPrevious(op);
  });
  return op;
});

/**
 * @class
 * A Set operation indicates that either the field was changed using
 * Obj.set, or it is a mutable container that was detected as being
 * changed.
 */
Op.Set = Op._extend(/** @lends Op.Set.prototype */ {
  _initialize: function (value) {
    this._value = value;
  },

  /**
   * Returns the new value of this field after the set.
   */
  value: function () {
    return this._value;
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return Parse._encode(this.value());
  },

  _mergeWithPrevious: function (previous) {
    return this;
  },

  _estimate: function (oldValue) {
    return this.value();
  }
});

/**
 * A sentinel value that is returned by Op.Unset._estimate to
 * indicate the field should be deleted. Basically, if you find _UNSET as a
 * value in your object, you should remove that key.
 */
Op._UNSET = {};

/**
 * @class
 * An Unset operation indicates that this field has been deleted from the
 * object.
 */
Op.Unset = Op._extend(/** @lends Op.Unset.prototype */ {
  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return { __op: "Delete" };
  },

  _mergeWithPrevious: function (previous) {
    return this;
  },

  _estimate: function (oldValue) {
    return Op._UNSET;
  }
});

Op._registerDecoder("Delete", function (json) {
  return new Op.Unset();
});

/**
 * @class
 * An Increment is an atomic operation where the numeric value for the field
 * will be increased by a given amount.
 */
Op.Increment = Op._extend(
    /** @lends Op.Increment.prototype */ {

  _initialize: function (amount) {
    this._amount = amount;
  },

  /**
   * Returns the amount to increment by.
   * @return {Number} the amount to increment by.
   */
  amount: function () {
    return this._amount;
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return { __op: "Increment", amount: this._amount };
  },

  _mergeWithPrevious: function (previous) {
    if (!previous) {
      return this;
    } else if (previous instanceof Op.Unset) {
      return new Op.Set(this.amount());
    } else if (previous instanceof Op.Set) {
      return new Op.Set(previous.value() + this.amount());
    } else if (previous instanceof Op.Increment) {
      return new Op.Increment(this.amount() + previous.amount());
    } else {
      throw "Op is invalid after previous op.";
    }
  },

  _estimate: function (oldValue) {
    if (!oldValue) {
      return this.amount();
    }
    return oldValue + this.amount();
  }
});

Op._registerDecoder("Increment", function (json) {
  return new Op.Increment(json.amount);
});

/**
 * @class
 * Add is an atomic operation where the given objects will be appended to the
 * array that is stored in this field.
 */
Op.Add = Op._extend(/** @lends Op.Add.prototype */ {
  _initialize: function (objects) {
    this._objects = objects;
  },

  /**
   * Returns the objects to be added to the array.
   * @return {Array} The objects to be added to the array.
   */
  objects: function () {
    return this._objects;
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return { __op: "Add", objects: Parse._encode(this.objects()) };
  },

  _mergeWithPrevious: function (previous) {
    if (!previous) {
      return this;
    } else if (previous instanceof Op.Unset) {
      return new Op.Set(this.objects());
    } else if (previous instanceof Op.Set) {
      return new Op.Set(this._estimate(previous.value()));
    } else if (previous instanceof Op.Add) {
      return new Op.Add(previous.objects().concat(this.objects()));
    } else {
      throw "Op is invalid after previous op.";
    }
  },

  _estimate: function (oldValue) {
    if (!oldValue) {
      return _.clone(this.objects());
    } else {
      return oldValue.concat(this.objects());
    }
  }
});

Op._registerDecoder("Add", function (json) {
  return new Op.Add(Parse._decode(undefined, json.objects));
});

/**
 * @class
 * AddUnique is an atomic operation where the given items will be appended to
 * the array that is stored in this field only if they were not already
 * present in the array.
 */
Op.AddUnique = Op._extend(
    /** @lends Op.AddUnique.prototype */ {

  _initialize: function (objects) {
    this._objects = _.uniq(objects);
  },

  /**
   * Returns the objects to be added to the array.
   * @return {Array} The objects to be added to the array.
   */
  objects: function () {
    return this._objects;
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return { __op: "AddUnique", objects: core._encode(this.objects()) };
  },

  _mergeWithPrevious: function (previous) {
    if (!previous) {
      return this;
    } else if (previous instanceof Op.Unset) {
      return new Op.Set(this.objects());
    } else if (previous instanceof Op.Set) {
      return new Op.Set(this._estimate(previous.value()));
    } else if (previous instanceof Op.AddUnique) {
      return new Op.AddUnique(
        _.union(previous.objects(), this.objects()));
    } else {
      throw "Op is invalid after previous op.";
    }
  },

  _estimate: function (oldValue) {
    if (!oldValue) {
      return _.clone(this.objects());
    } else {
      return oldValue.concat(_.difference(this.objects(), oldValue));
    }
  }
});

Op._registerDecoder("AddUnique", function (json) {
  return new Op.AddUnique(core._decode(undefined, json.objects));
});

/**
 * @class
 * Remove is an atomic operation where the given objects will be removed from
 * the array that is stored in this field.
 */
Op.Remove = Op._extend(/** @lends Op.Remove.prototype */ {
  _initialize: function (objects) {
    this._objects = _.uniq(objects);
  },

  /**
   * Returns the objects to be removed from the array.
   * @return {Array} The objects to be removed from the array.
   */
  objects: function () {
    return this._objects;
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    return { __op: "Remove", objects: core._encode(this.objects()) };
  },

  _mergeWithPrevious: function (previous) {
    if (!previous) {
      return this;
    } else if (previous instanceof Op.Unset) {
      return previous;
    } else if (previous instanceof Op.Set) {
      return new Op.Set(this._estimate(previous.value()));
    } else if (previous instanceof Op.Remove) {
      return new Op.Remove(_.union(previous.objects(), this.objects()));
    } else {
      throw "Op is invalid after previous op.";
    }
  },

  _estimate: function (oldValue) {
    if (!oldValue) {
      return [];
    } else {
      return _.difference(oldValue, this.objects());
    }
  }
});

Op._registerDecoder("Remove", function (json) {
  return new Op.Remove(core._decode(undefined, json.objects));
});

/**
 * @class
 * A Relation operation indicates that the field is an instance of
 * Relation, and objects are being added to, or removed from, that
 * relation.
 */
Op.Relation = Op._extend(
    /** @lends Op.Relation.prototype */ {

  _initialize: function (adds, removes) {
    this._targetClassName = null;

    var self = this;

    var pointerToId = function (object) {
      if (object instanceof Obj) {
        if (!object.id) {
          throw "You can't add an unsaved Obj to a relation.";
        }
        if (!self._targetClassName) {
          self._targetClassName = object.className;
        }
        if (self._targetClassName !== object.className) {
          throw "Tried to create a Relation with 2 different types: " +
                self._targetClassName + " and " + object.className + ".";
        }
        return object.id;
      }
      return object;
    };

    this.relationsToAdd = _.uniq(_.map(adds, pointerToId));
    this.relationsToRemove = _.uniq(_.map(removes, pointerToId));
  },

  /**
   * Returns an array of unfetched Obj that are being added to the
   * relation.
   * @return {Array}
   */
  added: function () {
    var self = this;
    return _.map(this.relationsToAdd, function (objectId) {
      var object = Obj._create(self._targetClassName);
      object.id = objectId;
      return object;
    });
  },

  /**
   * Returns an array of unfetched Obj that are being removed from
   * the relation.
   * @return {Array}
   */
  removed: function () {
    var self = this;
    return _.map(this.relationsToRemove, function (objectId) {
      var object = Obj._create(self._targetClassName);
      object.id = objectId;
      return object;
    });
  },

  /**
   * Returns a JSON version of the operation suitable for sending to Parse.
   * @return {Object}
   */
  toJSON: function () {
    var adds = null;
    var removes = null;
    var self = this;
    var idToPointer = function (id) {
      return { __type: 'Pointer',
               className: self._targetClassName,
               objectId: id };
    };
    var pointers = null;
    if (this.relationsToAdd.length > 0) {
      pointers = _.map(this.relationsToAdd, idToPointer);
      adds = { "__op": "AddRelation", "objects": pointers };
    }

    if (this.relationsToRemove.length > 0) {
      pointers = _.map(this.relationsToRemove, idToPointer);
      removes = { "__op": "RemoveRelation", "objects": pointers };
    }

    if (adds && removes) {
      return { "__op": "Batch", "ops": [adds, removes]};
    }

    return adds || removes || {};
  },

  _mergeWithPrevious: function (previous) {
    if (!previous) {
      return this;
    } else if (previous instanceof Op.Unset) {
      throw "You can't modify a relation after deleting it.";
    } else if (previous instanceof Op.Relation) {
      if (previous._targetClassName &&
          previous._targetClassName !== this._targetClassName) {
        throw "Related object must be of class " + previous._targetClassName +
            ", but " + this._targetClassName + " was passed in.";
      }
      var newAdd = _.union(_.difference(previous.relationsToAdd,
                                        this.relationsToRemove),
                           this.relationsToAdd);
      var newRemove = _.union(_.difference(previous.relationsToRemove,
                                           this.relationsToAdd),
                              this.relationsToRemove);

      var newRelation = new Op.Relation(newAdd, newRemove);
      newRelation._targetClassName = this._targetClassName;
      return newRelation;
    } else {
      throw "Op is invalid after previous op.";
    }
  },

  _estimate: function (oldValue, object, key) {
    if (!oldValue) {
      var relation = new Relation(object, key);
      relation.targetClassName = this._targetClassName;
    } else if (oldValue instanceof Relation) {
      if (this._targetClassName) {
        if (oldValue.targetClassName) {
          if (oldValue.targetClassName !== this._targetClassName) {
            throw "Related object must be a " + oldValue.targetClassName +
                ", but a " + this._targetClassName + " was passed in.";
          }
        } else {
          oldValue.targetClassName = this._targetClassName;
        }
      }
      return oldValue;
    } else {
      throw "Op is invalid after previous op.";
    }
  }
});

Op._registerDecoder("AddRelation", function (json) {
  return new Op.Relation(Parse._decode(undefined, json.objects), []);
});
Op._registerDecoder("RemoveRelation", function (json) {
  return new Op.Relation([], Parse._decode(undefined, json.objects));
});

module.exports = Op