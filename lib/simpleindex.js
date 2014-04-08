var utils = require("./utils");
var log = require("ringo/logging").getLogger(module.id);
var {Document} = org.apache.lucene.document;
var {Index} = require("./index.js");
var strings = require("ringo/utils/strings");
var {DefaultField} = require("./fields");
var {Query} = org.apache.lucene.search;

/**
 * Create a convenient index wrapping an index and registering
 * field-instances for the different fields stored inside this wrapped index.
 *
 * Fields are passed as properties of a js-object. The property-names
 * of this js-object will be the field-names and the value has to be
 * a Field implemented by using BaseField.extend() providing an
 * object containing functions to overwrite.
 * Those fields will convert the values according to their
 * type and the purpose.
 *
 * @class Creates a convenient wrapper around Index using Field-instances to build a bridge betweene js-values and lucene-values
 * @param index the index to wrap
 * @param fields an object holding the different field instances and a property defining the default field-name
 * @constructor
 */
var SimpleIndex = exports.SimpleIndex = function(index, fields) {
    if (!index || !fields || !fields.defaultField)
        throw new Error("Missing argument for SimpleIndex-constructor");
    Object.defineProperties(this, {
        "index": {
            "value": index,
            "writeable": false
        },
        "fields": {
            "value": fields || {},
            "writeable": false
        },
        "defaultField": {
            "value": fields.defaultField,
            "writeable": false
        }
    });
};

/**
 * Returns the field for the given field-name or creates
 * a new DefaultField for the given field and caches
 * it.
 */
SimpleIndex.prototype.getField = function(field) {
    var field = this.fields[field];
    if (!field) {
        field = this.fields[field] = new DefaultField({name: field, 
            store: false, index: this.index});
    }
    return field;
};

/**
 * Creates a lucene-document with the provided data using autoconversion which has been defined
 * on construction time of this simpleindex object
 * @param data a plain javascript object holding the values
 */
SimpleIndex.prototype.createDocument = function(data) {
    if (data.class && data.class.toString() == "class org.apache.lucene.document.Document")
        return data;
    var doc = new Document();
    for (var i in data) {
        if (data[i] === null || data[i] === undefined) {
            continue;
        }
        var conv = this.getField(i); 
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
            this.getField(field).encodeForQuery(value)); 
};

/**
 * Update the document where field has the value with the given data.
 * @param field the field which must have the given value to identify the document to update
 * @param value the value the given field must have to identify the document to update
 * @param data the javascript object holding the new values for this document
 */
SimpleIndex.prototype.update = function(field, value, data) {
    return this.index.update(field, 
            this.getField(field).encodeForQuery(value), 
            this.createDocument(data));
};

/**
 * Add this new document to the index. NOTE: if there is already a document
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
    limit = limit || 50;
    if (!(query instanceof Query)) {
        throw new Error("Query called with none-query object");
    }
    var searcher = this.index.getSearcher();
    var sr = searcher.search(query, limit);
    return {
        searcher: searcher, 
        query: query, 
        topdocs: sr, 
        limit: limit
    };
};

/**
 * Convert a lucene document to a native javascript document using
 * the configured fields.
 */
SimpleIndex.prototype.convertDocument = function(doc) {
    var jsDoc = {};
    var it = doc.iterator();
    while (it.hasNext()) {
        var indexableField = it.next();
        var name = indexableField.name();
        var val = this.getField(name).toJavaScript(indexableField);
        if (val == null || val == undefined)
            continue;
        jsDoc[name] = val;
    }
    return jsDoc;
};