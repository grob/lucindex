var {QueryParser, MultiFieldQueryParser} = org.apache.lucene.queryparser.classic;
var {Document, DoubleField, FloatField, IntField, LongField, StringField, TextField, Field} = org.apache.lucene.document;
var {BooleanClause} = org.apache.lucene.search;
var {Index} = require("./index.js");
var strings = require("ringo/utils/strings");
var moment = require("./ext/moment-with-langs");

var SimpleIndex = exports.SimpleIndex = function(index, config) {
    Object.defineProperties(this, {
        "index": {
            "value": index,
            "writeable": false
        },
        "meta": {
            "value": config.meta || {},
            "writeable": false
        }
    });
};

/**
 * Creates a lucene-document with the provided data
 */
SimpleIndex.prototype.createDocument = function(data) {
    var doc = new Document();
    for (var i in data) {
        doc.add(createField(i, data[i], this.meta[i]));
    }
    return doc;
};

/**
 * Check the configuration and use the correct lucene-Field for
 * the given value and setting the stored-state too.
 */
var createField = function(name, value, meta) {
    var type = "text";
    var store = Field.Store.NO;
    if (meta) {
        type = meta.type || "text";
        store = meta.store ? Field.Store.YES : Field.Store.NO;
    }
    switch(type) {
    case "double":
    case "float":
        return new DoubleField(name, value, store);
    case "int":
        return new IntField(name, value, store);
    case "date":
        // convert dates to long and store them as long-field
        if (typeof(value) == "object") {
            if (!value.getMonths) {
                throw new Error("SimpleIndex got date-field " + name + " but value isn't a date");
            }
            value = value.getTime();
        } else if (typeof(value) == "string") {
            var d = new Date(value);
            if (d.toString() == "Invalid Date") {
                throw new Error("SimpleIndex got date-field " + name + " but string provided did not parse to a valid date");
            }
            value = d.getTime();
        }
    case "long":
        return new LongField(name, value, store);
    case "string": // Strings aren't tokenized. use it for id's or fixed values
                   // like options from a selectbox
        return new StringField(name, fieldToString(value, meta), store);
    case "text":
    default:
        return new TextField(name, fieldToString(value, meta), store);
    };
};

var fieldToString = function(val, meta) {
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
            DateTools.dateToString(val, DateTools.Resolution[meta ? (meta.resolution || "MINUTE") : "MINUTE"]);
        }
        return val.toString();
    case "boolean":
        return val ? "true" : "false"
    }
    throw new Error("how is that possible? unknown type " + typeof(val));
};

/**
 * Encodes values to use them for 
 */
var encodeValue = function(value, meta) {
    if (!meta || !meta.type) {
        return value;
    }
    switch(meta.type) {
    case "int":
        return Index.prepareIntValue(value);
    case "double":
    case "float":   // unfortunately java-float-primitives
                    // converted to JS are not working correctly
                    // so we use double value instead
        return Index.prepareDoubleValue(value);
    case "long":
        return Index.prepareLongValue(value);
    }
    // no idea what to do with given type
    log.warn("SimpleIndex encodeValue encountered an unknown field-type:", meta.type);
    return value;
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

SimpleIndex.prototype.removeAll = function()  {
    return this.index.removeAll();
};
SimpleIndex.prototype.close = function() {
    return this.index.close();
};
SimpleIndex.prototype.size = function() {
    return this.index.size();
};

SimpleIndex.prototype.query = function(field, query, limit) {
    var start = new Date();
    limit = limit || 50;
    var q;
    if (Object.prototype.toString.call(field) == "[object Array]") {
        var bc = [];
        for (var i = 0; i < field.length; i++) {
            bc.push(BooleanClause.Occur.SHOULD);
        }
        var q = MultiFieldQueryParser.parse(this.index.version, query, field, bc, this.index.analyzer);
    } else {
        var qp = this.getQueryParser(field);
        q = qp.parse(query);
    }
    print("query: " + JSON.stringify(q.toString()));
    return new Result(this.index.searcher.search(q, limit), (new Date()) - start, this.index);
};

SimpleIndex.prototype.parseQuery = function(query) {
    var parts = query.split(/\s/);
    return parts.reduce(function (prev, val) {
        if (!isNaN(val)) {
            prev.numbers.push(parseFloat(val, 10));
        } else {
            var m = moment(val);
            if (!m.isValid()) {
                for each (var format in ["DD.MM.YYYY", "DD.MM.YYYY HH:mm", "HH:mm", "DD.MM."]) {
                    m = moment(val, format);
                    if (m.isValid()) {
                        
                    }
                }
            } 
            if (m.isValid()) {
                prev.dates.push(m.toDate().getTime());
            }
        }
        return prev;
    }, {whole: query, numbers: [], dates: []});
}

/**
 * QueryParser cache to avoid unneeded recreation
 */
SimpleIndex.prototype.getQueryParser = function(field) {
    if (!this.qpCache)
        this.qpCache = {};
    if (this.qpCache[field])
        return this.qpCache[field];
    return this.qpCache[field] = new QueryParser(this.index.version, field, this.index.analyzer); 
};

/**
 * Return the correct query-type for the field given depending on the
 * meta-information configured (int, double, string, text...)
 * Possible null if no aproprate way is available
 */
SimpleIndex.prototype.getQueryForField = function(field, query) {
    if (!query) {
        throw new Error("getQueryForField called without query-parameter");
    }
    var meta = this.meta[field];
    if (!meta || !meta.type) {
        return this.getQueryParser().parse(query);
    }
    
    switch (meta.type) {
    case "double":
        return !isNaN(query) ? new TermQuery(new Term(field, this.index.prepareDoubleValue(query))) : null;
    case "float":
        return !isNaN(query) ? new TermQuery(new Term(field, this.index.prepareFloatValue(query))) : null;
    case "int":
        return !isNaN(query) ? new TermQuery(new Term(field, this.index.prepareIntValue(query))) : null;
    case "date":
        // convert dates to long and store them as long-field
        var val;
        if (typeof(query) == "object") {
            if (!value.getMonths) {
                return null;
            }
            val = query.getTime();
        } else if (typeof(query) == "string") {
            var d = new Date(query);
            if (d.toString() == "Invalid Date") {
                if (isNaN(query))
                    return null;
                val = parseInt(query, 10);
            } else {
                val = d.getTime();
            }
        }
        return new TermQuery(new Term(field, this.index.prepareLongValue(val)));
    case "long":
        if (typeof(query) == "string") {
            return new TermQuery(new Term(field, this.index.prepareLongValue(parseInt(query, 10))));
        } else if (typeof(query) == "number") {
            return new TermQuery(new Term(field, this.index.prepareLongValue(query)));
        }
        return null;
    case "string": // Strings aren't tokenized. use it for id's or fixed values
                   // like options from a selectbox
        return (new PhraseQuery()).add(new Term(field, query));
    case "text":
    default:
        return new WildcardQuery(new Term(field, query));
    }
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
    
    this.serialize = function() {
        var result = [];
        for (var i = 0; i < this.size(); i++) {
            result.push({
                data: this.get(i),
                score: this.getScore(i)
            });
        }
        return {
            querytime: this.querytime,
            documents: result
        };
    };
    
    this.toJSON = function() {
        return JSON.stringify(this.serialize());
    };
};