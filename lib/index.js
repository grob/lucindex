/**
 * @fileoverview <p>This module provides functionality for
 * managing and searching a Lucene search index</p>
 * @example
 * var {Index} = require("lucindex");
 * var {Document, Field} = org.apache.lucene.document;
 * var index = Index.createRamIndex();
 * var doc = new Document();
 * doc.add(new Field("id", 1,
 *             Field.Store.YES, Field.Index.ANALYZED, Field.TermVector.NO))
 * // add the document to the index - this is done asynchronously!
 * index.add(doc);
 */
var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");

for each (var i in ["../jars/lucene-core-4.2.1.jar",
                    "../jars/lucene-analyzers-common-4.2.1.jar",
                    "../jars/lucene-queryparser-4.2.1.jar"]) {
    if (!addToClasspath(i)) throw new Error("lucindex unable to add " + i);
}


var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {IndexWriter, IndexWriterConfig, Term, DirectoryReader} = org.apache.lucene.index;
var {IndexSearcher, TopDocs} = org.apache.lucene.search;
var {Document, DoubleField, FloatField, IntField, LongField, StringField, TextField, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
var {QueryParser, MultiFieldQueryParser} = org.apache.lucene.queryparser.classic;
var {NumericUtils, BytesRef} = org.apache.lucene.util;

/**
 * @class Provides functionality for managing a Lucene based search index
 * @param {org.apache.lucene.store.Directory} directory The index directory to operate on
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @constructor
 */
var Index = exports.Index = function(directory, analyzer, config) {

    var self = this;
    var indexer = null;
    var reader = null;
    var searcher = null;
    if (!config.version) {
        config.version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        config.version = Version[config.version];
    }


    Object.defineProperties(this, {

        /**
         * Contains the directory this index instance operates on
         * @type org.apache.lucene.store.Directory
         */
        "directory": {
            "get": function() {
                return directory;
            }
        },

        /**
         * Contains the analyzer used for indexing
         * @type org.apache.lucene.analysis.Analyzer
         */
        "analyzer": {
            "get": function() {
                return analyzer;
            }
        },

        /**
         * Contains the index reader
         * @type org.apache.lucene.index.DirectoryReader
         */
        "reader": {
            "get": sync(function() {
                return reader || (reader = DirectoryReader.open(directory));
            })
        },

        /**
         * Contains the indexing worker
         * @type Worker
         */
        "indexer": {
            "get": sync(function() {
                if (indexer == null) {
                    indexer = new Worker(module.resolve("./indexwriter"));
                    indexer.onmessage = function(event) {
                        if (event.data.type == "closed") {
                            self.reopen();
                        }
                    };
                    indexer.onerror = function(event) {
                        log.error(event.data);
                    };
                }
                return indexer;
            })
        },
        /**
         * Contains the index searcher
         * @type org.apache.lucene.search.IndexSearcher
         */
        "searcher": {
            "get": sync(function() {
                return searcher || (searcher = new IndexSearcher(this.reader));
            })
        },
        /**
         * Contains the version this lucindex is running with (provided at createtime)
         */
        "version": {
            "value": config.version,
            "writable": false
        },
        /**
         * Contains meta-data describing fields which are indexed and/or stored in this index
         */
        "meta": {
            "value": config.meta,
            "writable": true
        }
    });

    /**
     * Reopens the index reader if the underlying index has been changed, and
     * purges the index searcher.
     */
    this.reopen = function() {
       if (reader !== null && reader.isCurrent() == false) {
           log.debug("Reopening index reader");
           reader = reader.openIfChanged(reader);
           searcher = null;
       }
       return;
    };

    return this;
};

/**
 * Initializes a search index.
 * @param {org.apache.lucene.store.Directory} directory The directory to operate on
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @param {Boolean} forceCreate If true the index will be emptied if already existing
 * @returns A new index instance
 * @type Index
 * @ignore
 */
var initIndex = function(directory, analyzer, config, forceCreate) {
    if (!config.version) {
        config.version = Version.LUCENE_42;
    } else if (typeof(config.version) == "string") {
        config.version = Version[config.version];
    }
    analyzer || (analyzer =  new StandardAnalyzer(config.version));
    var iwc = new IndexWriterConfig(config.version, analyzer);
    if (forceCreate === true) {
        iwc.setOpenMode(IndexWriterConfig.OpenMode.CREATE);
    } else {
        iwc.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
    }
    var writer = new IndexWriter(directory, iwc);
    // initially create the index (if necessary) by doing an empty commit
    writer.close();
    return new Index(directory, analyzer, config);
};

/**
 * Checks if the given document is actually a lucene-document or a javascript-construct
 * describing the lucene-document to create
 */
Index.prototype.createDocument = function(data) {
    var doc = new Document();
    for (var i in data) {
        doc.add(createField(i, data[i], this.meta[i]));
    }
    return doc;
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
        return new DoubleField(name, value, store);
    case "float":
        return new FloatField(name, value, store);
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

/**
 * Creates an in-memory index
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @param {org.apache.lucene.util.Version} version The version to use for the index 
 * @returns A new index instance
 * @type Index
 */
Index.createRamIndex = function(analyzer, config) {
    return initIndex(new RAMDirectory(), analyzer, config, true);
};

/**
 * Creates an index stored on disk
 * @param {String} dir The directory to store the index in
 * @param {String} name The name of the index. The index files will be stored in
 * a subdirectory with this name with the base directory passed as first argument.
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @param {org.apache.lucene.util.Version} version The version to use for the index 
 * @param {Boolean} forceCreate If true the index will be emptied if already existing
 * @returns A new index instance
 * @type Index
 */
Index.createIndex = function(dir, name, analyzer, config, forceCreate) {
    var file = new java.io.File(dir, name);
    return initIndex(FSDirectory.open(file), analyzer, config, forceCreate);
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
Index.toFloatValue = function(val) {
    return this.toIntValue(NumericUtils.floatToSortableInt(val));
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
Index.toIntValue = function(val) {
    var bytes = new BytesRef(NumericUtils.BUF_SIZE_INT);
    NumericUtils.intToPrefixCoded(val, 0, bytes);
    return bytes;
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
Index.toDoubleValue = function(val) {
    return this.toLongValue(NumericUtils.doubleToSortableLong(val));
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
Index.toLongValue = function(val) {
    var bytes = new BytesRef(NumericUtils.BUF_SIZE_LONG);
    NumericUtils.longToPrefixCoded(val, 0, bytes);
    return bytes;
};

/**
 * Returns the number of documents in this index
 * @returns The number of documents in this index
 * @type Number
 */
Index.prototype.size = function() {
   return this.reader.numDocs();
};

/**
 * Set the metadata describing fields indexed and/or stored
 * in this index
 * @param Object meta the object containing description of index-fields
 */
Index.prototype.setMetaData = function(meta) {
    this.meta = meta;
}

/**
 * Adds the document passed as argument asynchronously to the index.
 * @param {org.apache.lucene.document.Document} doc The document to add
 */
Index.prototype.add = function(doc) {
    this.indexer.postMessage({
        "type": "add",
        "index": this,
        "document": doc
    }, true);
};

var createTerm = function(name, value, meta) {
    if (!meta || !meta[name] || Object.prototype.toString.call(value) === "[object JavaObject]") {
        return new Term(name, value);
    }
    switch(meta[name].type) {
    case "float":
        value=Index.toFloatValue(value);
        break;
    case "int":
        value=Index.toIntValue(value);
        break;
    case "double":
        value=Index.toDoubleValue(value);
        break;
    case "long":
        value=Index.toLongValue(value);
        break;
    }
    return new Term(name, value);
};

/**
 * Removes all documents that match the given name/value pair from
 * the index. Removal is done asynchronously.
 * NOTE: if indexed value has not been indexed as string 
 *  you will have to either set the meta-data for the field
 *  or use one of the converter-functions to convert the
 *  value into a lucene-understandable ByteRef.
 * Those functions are:
 * Index.toFloatValue(val), Index.toIntValue(val), 
 * Index.toDoubleValue(val) and Index.toLongValue(val)
 * @param {String} name The name of the document field
 * @param {String} value The value of the document field 
 */
Index.prototype.remove = function(name, value) {
    this.indexer.postMessage({
        "type": "remove",
        "index": this,
        "term": createTerm(name, value, this.meta)
    }, true);
};

/**
 * Updates any existing document matching the name/value pair in the index.
 * Note that this is done asynchronously, so this method returns immediately.
 * NOTE: if indexed value has not been indexed as string you will
 *  have to use one of the converter-functions to convert the
 *  value into a luceneunderstandable ByteRef.
 * Those functions are:
 * Index.toFloatValue(val), Index.toIntValue(val), 
 * Index.toDoubleValue(val) and Index.toLongValue(val)
 * @param {String} name The name of the document field
 * @param {String} value The value of the document field
 * @param {org.apache.lucene.document.Document} doc The document to add
 */
Index.prototype.update = function(name, value, doc) {
    this.indexer.postMessage({
        "type": "update",
        "index": this,
        "term": createTerm(name, value, this.meta),
        "document": doc
    }, true);
};

/**
 * Asynchronously removes all documents from the index.
 */
Index.prototype.removeAll = function() {
    this.indexer.postMessage({
        "type": "removeAll",
        "index": this
    }, true);
};

/**
 * Closes the index writer. Normally it should never be necessary to
 * call this method manually, as the index writer will be closed when
 * all index manipulation jobs have been finished.
 */
Index.prototype.close = function() {
    this.indexer.postMessage({
        "type": "close"
    }, true);
};

Index.prototype.query = function(field, search, filter, limit) {
    var start = new Date();
    limit = limit || 50;
    var qp;
    if (Object.prototype.toString.call(field) == "[object Array]") {
        qp = new MultiFieldQueryParser(this.version, field, this.analyzer);
    } else {
        qp = QueryParser(this.version, field, this.analyzer);
    }
    var q = qp.parse(search);
    var topDocs = this.searcher.search(q, filter || null, limit);

    return new Result(topDocs, (new Date()) - start, this);
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
        return indexableField.stringValue();
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
};