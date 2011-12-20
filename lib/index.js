var log = require("ringo/logging").getLogger(module.id);
var {Worker} = require("ringo/worker");

addToClasspath("../jars/lucene-core-3.5.0.jar");
addToClasspath("../jars/lucene-analyzers-3.5.0.jar");

var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {IndexReader, IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {IndexSearcher} = org.apache.lucene.search;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

var Index = exports.Index = function(directory, analyzer) {

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
        "searcher": {
            "get": sync(function() {
                return searcher || (searcher = new IndexSearcher(this.reader));
            })
        }
    });

    this.reopen = function() {
       if (reader !== null && reader.isCurrent() == false) {
           log.debug("Reopening index reader");
           reader = reader.openIfChanged(reader, true);
           searcher = null;
       }
       return;
    };

    return this;
};

Index.initIndex = function(directory, analyzer, forceCreate) {
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
    return new Index(directory, analyzer || new StandardAnalyzer(Version.LUCENE_35));
};

Index.createRamIndex = function(analyzer) {
    var directory = Index.initRamDirectory();
    return Index.initIndex(directory, analyzer, true);
};

Index.createIndex = function(dir, name, analyzer, forceCreate) {
    var directory = Index.initDirectory(dir, name);
    return Index.initIndex(directory, analyzer, forceCreate);
};

Index.initRamDirectory = function() {
    return new RAMDirectory();
};

Index.initDirectory = function(dir, name) {
    var file = new java.io.File(dir, name);
    return FSDirectory.open(file);
};

Index.prototype.size = function() {
   return this.reader.numDocs();
};

Index.prototype.add = function(doc) {
    this.indexer.postMessage({
        "type": "add",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "document": doc
    }, true);
};

Index.prototype.remove = function(name, value) {
    this.indexer.postMessage({
        "type": "remove",
        "directory": this.directory,
        "analyzer": this.analyzer,
        "name": name,
        "value": value
    }, true);
};

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

Index.prototype.removeAll = function() {
    this.indexer.postMessage({
        "type": "removeAll",
        "directory": this.directory,
        "analyzer": this.analyzer
    }, true);
};

Index.prototype.close = function() {
    this.indexer.postMessage({
        "type": "close"
    }, true);
};
