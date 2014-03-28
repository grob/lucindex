var utils = require("./utils");
var log = require("ringo/logging").getLogger(module.id);
var {Document} = org.apache.lucene.document;
var {Index} = require("./index.js");
var strings = require("ringo/utils/strings");
var {DefaultField} = require("./converter");
var {BooleanQuery, BooleanClause} = org.apache.lucene.search;

/**
 * Create a convenient index wrapping an index and registering
 * converter for the different fields stored inside this wrapped index.
 * 
 * Converter are passed as properties of a js-object. The property-names
 * of this js-object will be the field-names and the value has to be
 * a converter implemented by using BaseField.extend() providing an
 * object containing functions to overwrite.
 * Those converting fields will convert the values according to their
 * type and the purpose.
 * 
 * @class Creates a convenient wrapper around Index using converter for different fields of this index
 * @param index the index to wrap
 * @param converter an object holding the different converter instances and a property defining the default field
 * @constructor
 */
var SimpleIndex = exports.SimpleIndex = function(index, converter) {
    if (!index || !converter || !converter.defaultField)
        throw new Error("Missing argument for SimpleIndex-constructor.");
    Object.defineProperties(this, {
        "index": {
            "value": index,
            "writeable": false
        },
        "converter": {
            "value": converter || {},
            "writeable": false
        },
        "defaultField": {
            "value": converter.defaultFiled,
            "writeable": false
        }
    });
};

/**
 * Returns the converter for the given field or creates
 * a new DefaultField for the given field and caches
 * it.
 */
SimpleIndex.prototype.getConverter = function(field) {
    var conv = this.converter[field];
    if (!conv) {
        conv = this.converter[field] = new DefaultField({name: field, 
            store: false, index: this.index});
    }
    return conv;
};

/**
 * Creates a lucene-document with the provided data using autoconversion which has been defined
 * on construction time of this simpleindex object
 * @param data a plain javascript object holding the values
 */
SimpleIndex.prototype.createDocument = function(data) {
    var doc = new Document();
    for (var i in data) {
        var conv = this.getConverter(i); 
        doc.add(conv.toLucene(data[i]));
    }
    return doc;
};

/**
 * Remove the document from the index having the given value. value will be autoconverted to
 * it's lucene-native form
 * @param field the field which must have the given value to identify the document to remove
 * @param value the value the given field must have to identify the document to remove
 */
SimpleIndex.prototype.remove = function(field, value) {
    return this.index.remove(field, 
            this.getConverter(field).encodeForQuery(value)); 
};

/**
 * Update the document where field has the value with the given data.
 * @param field the field which must have the given value to identify the document to update
 * @param value the value the given field must have to identify the document to update
 * @param data the javascript object holding the new values for this document
 */
SimpleIndex.prototype.update = function(field, value, data) {
    return this.index.update(field, 
            this.getConverter(field).encodeForQuery(value), 
            this.createDocument(data));
};

/**
 * Add this new document to the index. NOTE: if ther is already a document
 * contained having the same values, this will result in a duplicate record
 * @param data the javascript object holding the values for this new document
 */
SimpleIndex.prototype.add = function(data) {
    return this.index.add(this.createDocument(data));
};

/**
 * Removes all documents from the index
 */
SimpleIndex.prototype.removeAll = function()  {
    return this.index.removeAll();
};

/**
 * Close this index down.
 */
SimpleIndex.prototype.close = function() {
    return this.index.close();
};

/**
 * Get the size of this index (the number of documents contained)
 */
SimpleIndex.prototype.size = function() {
    return this.index.size();
};

/**
 * Convenience function returning a Result-Object holding all retrieved documents
 * @param query the lucene query-object used to search the index
 * @param limit the maximum number of document retrieved (defaults to 50)
 */
SimpleIndex.prototype.query = function(query, limit) {
    var start = new Date();
    limit = limit || 50;
    var q;
    if (Object.prototype.toString.call(query.class) != "[object JavaObject]" || 
            query.class.toString().indexOf("org.apache.lucene.search.") == -1) {
        throw new Error("Query called with none-query object");
    }
    log.debug ("query: " + query.toString());
    return new Result(this.index.searcher.search(query, limit), (new Date()) - start, this.index.searcher, this.converter);
};

/**
 * Create a query from a plain js-object.
 * The conditions-object's properties have to be fields and will be added to the query as SHOULD clauses.
 * If the object contains properties MUST or MUST_NOT, the properties of those objects will also
 * be fields added to the query with their corresponding clauses.
 * The value of those properties may be either a string (used as query string as is) or another object
 * having either the property "value" (again used as query-string as is) or the properties "min" and "max"
 * to form a range query. e.g. to search for documents having the value "test" in their text-field and
 * having a number betweene 1 and 10 in their "id"-field one would pass the following js-object to this function:
 * {text: "test", id: {min: 1, max: 10}}
 * If you don't want nr 5, then use this:
 * {text: "test", id: {min: 1, max: 10}, MUST_NOT: {id: 5}}
 * @param conditions a js-object describing the conditions for this query
 */
SimpleIndex.prototype.createQuery = function(conditions) {
    if (typeof(conditionArr) == "string") {
        // simple query for all fields
        return this.getQueryParser(this.defaultField).parse(conditionArr);
    }
    var bq = new BooleanQuery();
    var si = this;
    var addConditions = function(conArr, clause) {
        for (var field in conArr) {
            if (field == "MUST" || field == "MUST_NOT") {
                continue;
            }
            var query = si.getConverter(field).getQueryFor(conArr[field]);
            if (query == null)
                continue;
            bq.add(query, clause || BooleanClause.Occur.SHOULD);
        }
    }
    addConditions(conditions, BooleanClause.Occur.SHOULD);
    if (!conditions.MUST && !conditions.SHOULD && !conditions.MUST_NOT)
        return bq;
    if (conditions.MUST) {
        addConditions(conditions.MUST, BooleanClause.Occur.MUST);
    }
    if (conditions.MUST_NOT) {
        addConditions(conditions.MUST_NOT, BooleanClause.Occur.MUST_NOT);
    }
    return bq;
};

/**
 * @class Result-object holding query-time and the resulting top-documents of a lucene-search
 * @param topdocs the documents retrieved
 * @param querytime the time querying took
 * @param index the index the documents have been retrieved from
 * @constructor
 */
var Result = function(topdocs, querytime, searcher, converter) {
    this.size = function() {
        return topdocs.totalHits;
    };

    Object.defineProperties(this, {
        querytime: {
            value: querytime,
        },
        searcher: {
            value: searcher
        },
        rawTopDocs: {
            value: topdocs,
            readonly: true
            
        },
        converter: {
            value: converter,
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

    /**
     * Returns the nth document of this resultset as
     * plain javascript object.
     * @param idx the index this document has within this resultset
     */
    this.get = function(idx) {
        var doc = this.searcher.doc(topdocs.scoreDocs[idx].doc);
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

    /**
     * Returns the calculated score of the nth document of this resultset
     */
    this.getScore = function(idx) {
        return topdocs.scoreDocs[idx].score;
    };

    /**
     * Serialize this resultset to an js-object
     */
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
        return this.serialize();
    };
};