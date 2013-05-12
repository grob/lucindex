var {Document, DoubleField, FloatField, IntField, LongField, StringField, TextField, Field} = org.apache.lucene.document;
var {Index} = require("./index.js");

var SimpleIndex = exports.SimpleIndex = function(index, config) {
    Object.defineProperties(this, {
        "index": {
            "value": index,
            "writeable": false
        },
        "meta": {
            "value": config.meta,
            "writeable": false
        }
    });
};

/**
 * Checks if the given document is actually a lucene-document or a javascript-construct
 * describing the lucene-document to create
 */
SimpleIndex.prototype.createDocument = function(data) {
    var doc = new Document();
    for (var i in data) {
        doc.add(createField(i, data[i], this.meta[i]));
    }
    return doc;
};

SimpleIndex.prototype.remove = function(name, value) {
    return this.index.remove(name, 
            encodeValue(value, this.meta[name]));
};

SimpleIndex.prototype.update = function(name, value, data) {
    return this.index.update(name, 
            encodeValue(value, this.meta[name]), this.createDocument(data));
};

SimpleIndex.prototype.add = function(data) {
    return this.index.add(this.createDocument(data));
};

SimpleIndex.prototype.query = function(field, search, filter, limit) {
    var start = new Date();
    var topDocs = this.index.query(field, search, filter, limit);
    return new Result(topDocs, (new Date()) - start, this.index);
};

SimpleIndex.prototype.removeAll = function()  {
    return this.index.removeAll();
};
SimpleIndex.prototype.close = function() {
    return this.index.close();
};
SimpleIndex.prototype.size = function() {
    return this.index.size();
};

var createField = function(name, value, meta) {
    var type = "string";
    var store = Field.Store.NO;
    if (meta) {
        type = meta.type || "string";
        store = meta.store ? Field.Store.YES : Field.Store.NO;
    }
    switch(type) {
    case "double":
    case "float":
        return new DoubleField(name, value, store);
    
//        return new FloatField(name, value, store);
    case "int":
        return new IntField(name, value, store);
    case "long":
        return new LongField(name, value, store);
    case "string":
        return new StringField(name, fieldToString(value), store);
    case "text":
    default:
        return new TextField(name, fieldToString(value), store);
    };
};

var fieldToString = function(val) {
    switch(typeof(val)) {
    case null:
    case "undefined":
        return null;
    case "string":
        return val;
    case "number":
        return ""+val;
    case "object":
        if (Object.prototype.toString.call(val) === "[object Date]") {
            DateTools.dateToString(val, DateTools.Resolution.MINUTE);
        }
        return val.toString();
    case "boolean":
        return val ? "true" : "false"
    }
    throw new Error("how is that possible? unknown type " + typeof(val));
};

var encodeValue = function(value, meta) {
    if (!meta) {
        return value;
    }
    switch(meta.type) {
    case "float": // unfortunately java-float-primitives
                  // converted to JS are not working correctly
                  // so we use double value instead
        return Index.toDoubleValue(value);
    case "int":
        return Index.toIntValue(value);
    case "double":
        return Index.toDoubleValue(value);
    case "long":
        return Index.toLongValue(value);
    }
    // no idea what to do with given type
    log.warn("unknown field-type:", meta.type);
    return value;
};

var Result = function(topdocs, querytime, index) {
    this.size = function() {
        return topdocs.totalHits;
    };
    
    Object.defineProperties(this, {
        querytime: {
            value: querytime,
        },
        index: {
            value: index
        },
        rawTopDocs: {
            value: topdocs,
            readonly: true
            
        }
    })
    
    var extractFieldValue = function (indexableField) {
        var ift = indexableField.fieldType();
        if (!ift.stored()) {
            return;
        }
        var val = indexableField.numericValue();
        if (val == null)
            val = indexableField.stringValue();
        return val;
    };
    
    this.get = function(idx) {
        var doc = index.searcher.doc(topdocs.scoreDocs[idx].doc);
        if (doc == null)
            return null;
        var it = doc.iterator();
        var result = {};
        while (it.hasNext()) {
            var indexableField = it.next();
            var val = extractFieldValue(indexableField);
            if (!val)
                continue;
            result[indexableField.name()] = val;
        }
        return result;
    };

    this.getScore = function(idx) {
        return topdocs.scoreDocs[idx].score;
    };
    
    this.toJSON = function() {
        var result = [];
        for (var i = 0; i < this.size(); i++) {
            result.push({
                data: this.get(i),
                score: this.getScore(i)
            })
        }
        return JSON.stringify(result);
    };
};