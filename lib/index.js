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
var {IndexWriter, IndexWriterConfig, DirectoryReader} = org.apache.lucene.index;
var {IndexSearcher, TopDocs} = org.apache.lucene.search;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
var {QueryParser, MultiFieldQueryParser} = org.apache.lucene.queryparser.classic;
var {NumericUtils, BytesRef} = org.apache.lucene.util;

/**
 * @class Provides functionality for managing a Lucene based search index
 * @param {org.apache.lucene.store.Directory} directory The index directory to operate on
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @constructor
 */
var Index = exports.Index = function(directory, analyzer, version) {

    var self = this;
    var indexer = null;
    var reader = null;
    var searcher = null;
    if (!version) {
        version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        version = Version[version];
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
            "value": version,
            "writable": false
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
 * @param version String or org.apach.lucene.utils.Version defining the version to use for this index
 * @param {Boolean} forceCreate If true the index will be emptied if already existing
 * @returns A new index instance
 * @type Index
 * @ignore
 */
var initIndex = function(directory, analyzer, version, forceCreate) {
    if (!version) {
        version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        version = Version[version];
    }
    analyzer || (analyzer =  new StandardAnalyzer(version));
    var iwc = new IndexWriterConfig(version, analyzer);
    if (forceCreate === true) {
        iwc.setOpenMode(IndexWriterConfig.OpenMode.CREATE);
    } else {
        iwc.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
    }
    var writer = new IndexWriter(directory, iwc);
    // initially create the index (if necessary) by doing an empty commit
    writer.close();
    return new Index(directory, analyzer, version);
};

/**
 * Creates an in-memory index
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @param string or {org.apache.lucene.util.Version} version The version to use for the index 
 * @returns A new index instance
 * @type Index
 */
Index.createRamIndex = function(analyzer, version) {
    return initIndex(new RAMDirectory(), analyzer, version, true);
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
Index.createIndex = function(dir, name, analyzer, version, forceCreate) {
    var file = new java.io.File(dir, name);
    return initIndex(FSDirectory.open(file), analyzer, version, forceCreate);
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
Index.toFloatValue = function(val) {
    // FIXME: is there a possibility to avoid the rhino-bug where java-float-primitives are buggy (e.g. 5.3 -> 5.30000019###)
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

/**
 * Removes all documents that match the given name/value pair from
 * the index. Removal is done asynchronously.
 * NOTE: if indexed value has not been indexed as string 
 *  you will have to use one of the converter-functions to convert 
 *  the value into a lucene-understandable ByteRef.
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
        "name": name,
        "value": value
    }, true);
};

/**
 * Updates any existing document matching the name/value pair in the index.
 * Note that this is done asynchronously, so this method returns immediately.
 * NOTE: if indexed value has not been indexed as string 
 *  you will have to use one of the converter-functions to convert 
 *  the value into a lucene-understandable ByteRef.
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
        "name": name,
        "value": value,
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
    limit = limit || 50;
    var qp;
    if (Object.prototype.toString.call(field) == "[object Array]") {
        qp = new MultiFieldQueryParser(this.version, field, this.analyzer);
    } else {
        qp = QueryParser(this.version, field, this.analyzer);
    }
    var q = qp.parse(search);
    return this.searcher.search(q, filter || null, limit);
};
