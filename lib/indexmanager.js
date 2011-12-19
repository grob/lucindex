var {Worker} = require("ringo/worker");

addToClasspath("../jars/lucene-core-3.5.0.jar");
addToClasspath("../jars/lucene-analyzers-3.5.0.jar");

var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {IndexReader, IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {IndexSearcher} = org.apache.lucene.search;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

var IndexManager = exports.IndexManager = function(directory, analyzer) {

    var self = this;
    var indexer = null;
    var reader = null;
    var searcher = null;

    Object.defineProperties(this, {
        "directory": {
            "get": function() {
                return directory;
            }
        },
        "analyzer": {
            "get": function() {
                return analyzer;
            }
        },
        "reader": {
            "get": sync(function() {
                return reader || (reader = IndexReader.open(directory, true));
            })
        },
        "indexer": {
            "get": sync(function() {
                if (indexer == null) {
                    indexer = new Worker(module.resolve("./indexwriter"));
                    indexer.onmessage = function(event) {
                        if (event.data.type === "closed") {
                            self.reopen();
                        }
                    };
                    indexer.onerror = function(event) {
                        console.warn("ERROR", event.toSource());
                    };
                }
                return indexer;
            })
        },
        "searcher": {
            "get": sync(function() {
                return searcher || (searcher = new IndexSearcher(this.reader));
            })
        }
    });

    this.reopen = function() {
       if (reader !== null && reader.isCurrent() == false) {
           console.log("Reopening index reader");
           reader = reader.openIfChanged(reader, true);
           searcher = null;
       }
       return;
    };

    return this;
};

IndexManager.initIndex = function(directory, analyzer, forceCreate) {
    var config = new IndexWriterConfig(Version.LUCENE_35, analyzer ||
            new StandardAnalyzer(Version.LUCENE_35));
    if (forceCreate === true) {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE);
    } else {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
    }
    var writer = new IndexWriter(directory, config);
    // initially create the index (if necessary) by doing an empty commit
    writer.close();
    return new IndexManager(directory, analyzer || new StandardAnalyzer(Version.LUCENE_35));
};

IndexManager.createRamIndex = function(analyzer) {
    var directory = IndexManager.initRamDirectory();
    return IndexManager.initIndex(directory, analyzer, true);
};

IndexManager.createIndex = function(dir, name, analyzer, forceCreate) {
    var directory = IndexManager.initDirectory(dir, name);
    return IndexManager.initIndex(directory, analyzer, forceCreate);
};

IndexManager.initRamDirectory = function() {
    return new RAMDirectory();
};

IndexManager.initDirectory = function(dir, name) {
    var file = new java.io.File(dir, name);
    return FSDirectory.open(file);
};

IndexManager.prototype.size = function() {
   return this.reader.numDocs();
};

IndexManager.prototype.add = function(doc) {
    this.indexer.postMessage({
        "type": "add",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "document": doc
    });
};

IndexManager.prototype.remove = function(name, value) {
    this.indexer.postMessage({
        "type": "remove",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "name": name,
        "value": value
    });
};

IndexManager.prototype.update = function(name, value, doc) {
    this.indexer.postMessage({
        "type": "update",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "name": name,
        "value": value,
        "document": doc
    });
};

IndexManager.prototype.removeAll = function() {
    this.indexer.postMessage({
        "type": "removeAll",
        "directory": this.directory,
        "analyzer": this.analyzer
    });
};

IndexManager.prototype.close = function() {
    this.indexer.postMessage({
        "type": "close"
    });
};
