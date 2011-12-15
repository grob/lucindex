var fs = require("fs");
var {Worker} = require("ringo/worker");

addToClasspath("../jars/lucene-core-3.5.0.jar");
addToClasspath("../jars/lucene-analyzers-3.5.0.jar");

var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {IndexReader, IndexWriter, IndexWriterConfig} = org.apache.lucene.index;
var {IndexSearcher} = org.apache.lucene.search;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

var IndexManager = exports.IndexManager = function(writer) {

    var indexer = null;
    var reader = null;
    var searcher = null;

    Object.defineProperties(this, {
        "directory": {
            "get": function() {
                return writer.getDirectory();
            }
        },
        "indexer": {
            "get": function() {
                return indexer;
            }
        },
        "reader": {
            "get": function() {
                return reader || (reader = IndexReader.open(writer, true));
            }
        },
        "writer": {
            "get": function() {
                return writer;
            }
        },
        "searcher": {
            "get": function() {
                return searcher || (searcher = new IndexSearcher(reader));
            }
        }
    });

    this.start = function() {
        if (indexer === null) {
            var manager = this;
            indexer = new Worker(module.resolve("./indexer"));
            indexer.onmessage = function(event) {
                console.log("got message from indexer:", event.data.toSource());
                manager.reopen();
            };
            return true;
        }
        return false;
    };

    this.stop = function() {
        if (indexer !== null) {
            indexer.terminate();
            indexer = null;
            writer.commit();
            this.reopen();
            return true;
        }
        return false;
    };

    this.reopen = function() {
       if (reader !== null && !reader.isCurrent()) {
          reader = reader.openIfChanged(reader, true);
          searcher = new IndexSearcher(reader);
       }
       return;
    };

    return this;
};

IndexManager.createRamIndex = function(analyzer) {
    var directory = IndexManager.initRamDirectory();
    var writer = IndexManager.initWriter(directory, analyzer || new StandardAnalyzer(Version.LUCENE_35));
    return new IndexManager(writer);
};

IndexManager.createIndex = function(dir, name, analyzer, force) {
    var directory = IndexManager.initDirectory(dir, name);
    var writer = IndexManager.initWriter(directory, analyzer, force);
    return new IndexManager(writer);
};

IndexManager.initRamDirectory = function() {
    return new RAMDirectory();
};

IndexManager.initDirectory = function(dir, name) {
    var file = new java.io.File(dir, name);
    return FSDirectory.open(file);
};

IndexManager.initWriter = function(directory, analyzer, force) {
    var config = new IndexWriterConfig(Version.LUCENE_35, analyzer || null);
    if (force === true || IndexReader.indexExists(directory) === false) {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE);
    } else {
        config.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
    }
    var writer = new IndexWriter(directory, config);
    // FIXME: is this really necessary?
    writer.commit();
    return writer;
};

IndexManager.addField = function(doc, name, value, options) {
   if (value !== null && value !== undefined) {
      doc.add(new Field(name, value,
            (options && options.store) || Field.Store.YES,
            (options && options.index) || Field.Index.ANALYZED,
            (options && options.termVector) || Field.TermVector.NO)
      );
   }
   return;
};

IndexManager.prototype.isRunning = function() {
    return this.indexer !== null;
};

IndexManager.prototype.size = function() {
   return this.reader.numDocs();
};

IndexManager.prototype.add = function(doc, sync) {
    if (sync === true) {
        // synchronous adding of document
        this.writer.addDocument(doc);
        this.writer.commit();
        this.reopen();
    } else {
        // asynchronous adding of document
        var indexer = this.initIndexer();
        indexer.postMessage(doc);
    }
    return true;
};

IndexManager.prototype.initIndexer = function() {
    var manager = this;
    var indexer = new Worker({
        "onmessage": function(event) {
            if (event.data.constructor === Array) {
                manager.writer.addDocuments(event.data);
            } else {
                manager.writer.addDocument(event.data);
            }
            manager.writer.commit();
            manager.reopen();
        }
    });
    return indexer;
};
