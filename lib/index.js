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

addToClasspath("../jars/lucene-core-4.7.0.jar");
addToClasspath("../jars/lucene-analyzers-common-4.7.0.jar");
addToClasspath("../jars/lucene-queryparser-4.7.0.jar");

var {File} = java.io;
var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {DirectoryReader, IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {SearcherManager, SearcherFactory} = org.apache.lucene.search;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

/**
 * @class Provides functionality for managing a Lucene based search index
 * @param {org.apache.lucene.store.Directory} directory The index directory to operate on
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @constructor
 */
var Index = exports.Index = function(directory, analyzer) {

    var indexer = null;
    var reader = null;
    var searcherManager = null;
    var lock = {};

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
         * @type org.apache.lucene.index.IndexReader
         */
        "reader": {
            "get": sync(function() {
                if (reader === null) {
                    log.debug("Created reader");
                    return reader = DirectoryReader.open(directory);
                }
                var newReader = DirectoryReader.openIfChanged(reader);
                if (newReader !== null) {
                    log.debug("Reopened reader");
                    reader.close();
                    reader = newReader;
                }
                return reader;
            }, lock)
        },

        /**
         * Contains the indexing worker
         * @type Worker
         */
        "indexer": {
            "get": sync(function() {
                if (indexer == null) {
                    log.debug("Created indexer");
                    indexer = new Worker(module.resolve("./indexwriter"));
                    indexer.onmessage = function(event) {
                        if (event.data.type == "closed" && searcherManager !== null) {
                            searcherManager.maybeRefresh();
                        }
                    };
                    indexer.onerror = function(event) {
                        log.error(event.data);
                    };
                }
                return indexer;
            }, lock)
        },

        /**
         * Contains the index searcher
         * @type org.apache.lucene.search.IndexSearcher
         */
        "searcherManager": {
            "get": sync(function() {
                if (searcherManager === null) {
                    log.debug("Created searcher manager");
                    searcherManager = new SearcherManager(directory,
                            new SearcherFactory);
                }
                return searcherManager;
            }, lock)
        }
    });

    /**
     * Closes the index. Normally it should never be necessary to
     * call this method manually, as the index will be closed when
     * all index manipulation jobs have been finished.
     */
    this.close = function() {
        if (indexer !== null) {
            indexer.postMessage({
                "type": "close"
            }, true);
            indexer = null;
        }
        if (searcherManager !== null) {
            searcherManager.close();
            searcherManager = null;
        }
        if (reader !== null) {
            reader.close();
            reader = null;
        }
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
Index.initIndex = function(directory, analyzer, forceCreate) {
    var config = new IndexWriterConfig(Version.LUCENE_47, analyzer ||
            new StandardAnalyzer(Version.LUCENE_47));
    if (forceCreate === true) {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE);
    } else {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
    }
    var writer = new IndexWriter(directory, config);
    // initially create the index (if necessary) by doing an empty commit
    writer.close();
    return new Index(directory, analyzer || new StandardAnalyzer(Version.LUCENE_47));
};

/**
 * Creates an in-memory index
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @returns A new index instance
 * @type Index
 */
Index.createRamIndex = function(analyzer) {
    var directory = Index.initRamDirectory();
    return Index.initIndex(directory, analyzer, true);
};

/**
 * Creates an index stored on disk
 * @param {String} dir The directory to store the index in
 * @param {String} name The name of the index. The index files will be stored in
 * a subdirectory with this name with the base directory passed as first argument.
 * @param {org.apache.lucene.analysis.Analyzer} analyzer The analyzer to use for indexing
 * @param {Boolean} forceCreate If true the index will be emptied if already existing
 * @returns A new index instance
 * @type Index
 */
Index.createIndex = function(dir, name, analyzer, forceCreate) {
    var directory = Index.initDirectory(dir, name);
    return Index.initIndex(directory, analyzer, forceCreate);
};

/**
 * Returns a new in-memory index directory
 * @returns {org.apache.lucene.store.RAMDirectory} The RAM directory instance
 * @see Index.createRamIndex
 * @ignore
 */
Index.initRamDirectory = function() {
    return new RAMDirectory();
};

/**
 * Returns a new disk persisted index directory
 * @returns {org.apache.lucene.store.FSDirectory} The directory instance
 * @see Index.createIndex
 * @ignore
 */
Index.initDirectory = function(dir, name) {
    return FSDirectory.open(new File(dir, name));
};

/**
 * Returns a searcher. Pass it to `releaseSearcher()` after searching is finished.
 * @returns {IndexSearcher} The searcher
 */
Index.prototype.getSearcher = function() {
    return this.searcherManager.acquire();
};

/**
 * Releases the search passed as argument.
 * @param {IndexSearcher} searcher The searcher to release
 */
Index.prototype.releaseSearcher = function(searcher) {
    return this.searcherManager.release(searcher);
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
        "directory": this.directory,
        "analyzer": this.analyzer,
        "document": doc
    }, true);
};

/**
 * Removes all documents that match the given name/value pair from
 * the index. Removal is done asynchronously.
 * @param {String} name The name of the document field
 * @param {String} value The value of the document field
 */
Index.prototype.remove = function(name, value) {
    this.indexer.postMessage({
        "type": "remove",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "name": name,
        "value": value
    }, true);
};

/**
 * Updates any existing document matching the name/value pair in the index.
 * Note that this is done asynchronously, so this method returns immediately.
 * @param {String} name The name of the document field
 * @param {String} value The value of the document field
 * @param {org.apache.lucene.document.Document} doc The document to add
 */
Index.prototype.update = function(name, value, doc) {
    this.indexer.postMessage({
        "type": "update",
        "directory": this.directory,
        "analyzer": this.analyzer,
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
        "directory": this.directory,
        "analyzer": this.analyzer
    }, true);
};
