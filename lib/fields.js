var {DoubleField, FloatField, IntField, Field,
    LongField, StringField, TextField} = org.apache.lucene.document;
var utils = require("./utils");
var {BooleanQuery, BooleanClause, WildcardQuery, 
    NumericRangeQuery, TermQuery, PhraseQuery} = org.apache.lucene.search;
var {QueryParser} = org.apache.lucene.queryparser.classic;
var {Term} = org.apache.lucene.index;

/**
 * Fields are definitions holding functions which get called by
 * SimpleIndex for the different interactions with lucene converting
 * the values from js to locene for query, update, remove and back from
 * lucene to js if the value is a index-stored value.
 * Namely those are:
 * toLucene: This will create the lucene-native Field with the given javascript value
 * encodeForQuery: This will create a lucene-understandable format for removing/updating/querying documents
 * toJavaScript: The stored value will be converted back to javascript. This step is optional. See DateField for an example.
 * getQueryFor: This constructs a lucene-query with the given value
 */
var BaseField = function(config) {
    var config = config || {};
    Object.defineProperties(this, {
        name: {
            value: config.name,
            writeable: false
        },
        store: {
            value: config.store || false,
            writeable: false
        }
    });
};

/**
 * Overwrite this with the apropriate lucene-native Field implementation
 * you want to use for your custom field
 */
BaseField.prototype.toLucene = function() {
    throw new Error("BaseField.toLucene has to be implemented");
};

/**
 * If indexing your value needs some preprocessing of the given value
 * do it here. e.g. this is needed for the different numeric values (see IntField, DoubleField...)
 */
BaseField.prototype.encodeForQuery = function(val) {
    return val;
};

/**
 * Converts a index-stored-value back to javascript. This has to be overwritten in case of
 * values which get preprocessed before storing them in an index. (see DateField)
 */
BaseField.prototype.toJavaScript = function(indexableField) {
    var ift = indexableField.fieldType();
    if (!ift.stored()) {
        return;
    }
    
    var val = indexableField.numericValue();
    if (val == null) {
        val = indexableField.stringValue();
    }
    return val;
};

/**
 * Overwrite this with a function returning an apropriate lucene-query for
 * your field-type.
 */
BaseField.prototype.getQueryFor = function() {
    throw new Error("BaseField.getQueryFor has to be implemented");
};

/**
 * Takes a descriptor-object holding the functions and possible the constructor
 * to overwrite. (See different fields defined in this file.
 */
BaseField.extend = function(desc) {
    var extended;
    if (desc.hasOwnProperty("constructor")) {
        extended = desc.constructor; 
    } else {
        extended = function(config) {
            BaseField.call(this, config);
        };
    }
    extended.prototype = Object.create(BaseField.prototype);
    for (var prop in desc) {
        if (prop == "constructor") {
            continue;
        }
        extended.prototype[prop] = desc[prop];
    }
    return extended;
}

/**
 * The DefaultField is basically equivalent to TextField but doesn't
 * return wildcardquery. It will return a query parsed by a queryparser
 * instead. 
 */
exports.DefaultField = BaseField.extend({
    constructor: function(config) {
        BaseField.call(this, config);
        Object.defineProperty(this, "queryparser", {
            value: new QueryParser(config.index.version, 
                    config.name, config.index.analyzer),
            writeable: false
        });
        return this;
    },
    toLucene: function(val) {
        var val = utils.ensureString(val);
        if (val == null) {
            return null;
        }
        return new TextField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    getQueryFor: function(val) {
        if (val == null || val == undefined) {
            return null;
        }
        return this.queryparser.parse(value);
    }
});

/**
 * TextField uses wildcardquery for querying.
 */
exports.TextField = BaseField.extend({
    toLucene: function(val) {
        var val = utils.ensureString(val);
        if (val == null) {
            return null;
        }
        return new TextField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    getQueryFor: function(val) {
        return new WildcardQuery(new Term(this.name, val.toLowerCase()));
    }
});

/**
 * DoubleField converts values to lucene-understandable format when querying/updating/removing
 * documents
 */
exports.DoubleField = exports.FloatField = BaseField.extend({
    toLucene: function(val) {
        return new DoubleField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    encodeForQuery: function(val) {
        return utils.prepareDoubleValue(val);
    },
    getQueryFor: function(val) {
        if (val == null || val == undefined) {
            return null;
        }
        if (typeof(val) == "object" && val.min != undefined && val.max != undefined) {
            return NumericRangeQuery.newDoubleRange(this.name, val.min, val.max, true, true);
        } else if (isNaN(val)) {
            throw new Error("DoubleField.getQueryFor called with none numeric value");
        }
        return new TermQuery(new Term(this.name, utils.prepareDoubleValue(val)));
    }
});

/**
 * IntField converts values to lucene-understandable format when querying/updating/removing
 * documents
 */
exports.IntField = BaseField.extend({
    toLucene: function(val) {
        return new IntField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    encodeForQuery: function(val) {
        return utils.prepareIntValue(val);
    },
    getQueryFor: function(val) {
        if (val == null || val == undefined) {
            return null;
        }
        if (typeof(val) == "object" && val.min != undefined && val.max != undefined) {
            return NumericRangeQuery.newIntRange(this.name, val.min, val.max, true, true);
        } else if (isNaN(val)) {
            throw new Error("IntField.getQueryFor called with none numeric value");
        }
        return new TermQuery(new Term(this.name, utils.prepareIntValue(val)));
    }
});

/**
 * Just a little helper to get more information about a value if the value
 * wasn't a date. Used to add information about the value in error-messages
 * of DateField
 */
var getValueInfo = function(val) {
    var result = "\nvalue: " + val;
    result += "\ntypeof: " + typeof(val);
    if (typeof(val) == "object") {
        result += "\ntoString(): " + val.toString();
        result += "\ngetMonth(): " + val.getMonth;
    }
    return result;
}

/**
 * DateField converts JS-Dates/Strings/Numbers to a lucene-understandable LongField
 * allowing range-queries and sorting.
 * It also converts the stored value back into a javascript-date when retrieved from the index.
 */
exports.DateField = BaseField.extend({
    constructor: function(config) {
        BaseField.call(this, config);
        Object.defineProperty(this, "resolution", {
                value: config.resolution,
                writeable: false
        });
    },
    toLucene: function(val) {
        var dat = utils.convertToDate(val, this.resolution);
        if (!dat) {
            throw new Error("None-Date-Value may not be converted by DateField" + getValueInfo(val));
        }
        return new LongField(this.name, dat.getTime(), this.store ? Field.Store.YES : Field.Store.NO);
    },
    encodeForQuery: function(val) {
        var dat = utils.convertToDate(val, this.resolution);
        if (!dat)
            throw new Error("None-Date-Value may not be encoded for query by DateField" + getValueInfo(val));
        return utils.prepareLongValue(dat.getTime());
    },
    toJavaScript: function(indexableField) {
        var ift = indexableField.fieldType();
        if (!ift.stored()) {
            return;
        }
        
        var val = indexableField.numericValue();
        if (val == null) {
            return new Date(parseInt(indexableField.stringValue(), 10));
        } else {
            return new Date(val);
        }
    },
    getQueryFor: function(val) {
        if (val == null || val == undefined) {
            return null;
        }
        if (typeof(val) == "object" && val.min != undefined 
                && val.max != undefined) {
            var min = utils.convertToDate(val.min, this.resolution),
                max = utils.convertToDate(val.max, this.resolution);
            if (min == null || max == null) {
                throw new Error("None-date-values may not be used for querying a DateField\nMin:" +
                        getValueInfo(val.min) + "\nMax:" + getValueInfo(val.max));
            }
            return NumericRangeQuery.newLongRange(this.name, 
                    min.getTime(), max.getTime(), 
                    true, true);
        } else {
            var dat = utils.convertToDate(val, this.resolution);
            if (dat == null) {
                throw new Error("None-date-value may not be used for querying a DateField" + getValueInfo(val));
            }
            return new TermQuery(new Term(this.name, utils.prepareLongValue(dat.getTime())));
        }
    }
});

/**
 * LongField converts values to lucene-understandable format when querying/updating/removing
 * documents
 */
exports.LongField = BaseField.extend({
    toLucene: function(val) {
        return new LongField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    encodeForQuery: function(val) {
        return utils.prepareLongValue(val);
    },
    getQueryFor: function(val) {
        if (val == null || val == undefined) {
            return null;
        }
        if (typeof(val) == "object" && val.min != undefined && val.max != undefined) {
            return NumericRangeQuery.newLongRange(this.name, val.min, val.max, true, true);
        } else if (isNaN(val)) {
            throw new Error("DoubleField.getQueryFor called with none numeric value");
        }
        return new TermQuery(new Term(this.name, utils.prepareLongValue(val)));
    }
});

/**
 * StringField the most basic field i can think of.
 */
exports.StringField = BaseField.extend({
    toLucene: function(val) {
        var val = utils.ensureString(val);
        if (val == null) {
            return null;
        }
        return new StringField(this.name, val, this.store ? Field.Store.YES : Field.Store.NO);
    },
    getQueryFor: function(val) {
        return new TermQuery(new Term(this.name, val));
    }
});