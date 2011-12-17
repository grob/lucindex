var {Worker} = require("ringo/worker");

addToClasspath("../jars/lucene-core-3.5.0.jar");
addToClasspath("../jars/lucene-analyzers-3.5.0.jar");

var {Version} = org.apache.lucene.util;
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {IndexReader, IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
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
                return searcher || (searcher = new IndexSearcher(this.reader));
            }
        }
    });

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
    var writer = IndexManager.initWriter(directory,
             analyzer || new StandardAnalyzer(Version.LUCENE_35));
    return new IndexManager(writer);
};

IndexManager.createIndex = function(dir, name, analyzer, force) {
    var directory = IndexManager.initDirectory(dir, name);
    var writer = IndexManager.initWriter(directory,
             analyzer || new StandardAnalyzer(Version.LUCENE_35), force);
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
    var config = new IndexWriterConfig(Version.LUCENE_35, analyzer);
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

IndexManager.prototype.size = function() {
   return this.reader.numDocs();
};

IndexManager.prototype.add = function(doc, doCommit) {
    // callback argument is executed in the context of this index manager instance
    var indexer = this.createWorker(function(event) {
        if (event.data.constructor === Array) {
            this.writer.addDocuments(event.data);
        } else {
            this.writer.addDocument(event.data);
        }
    }, doCommit);
    indexer.postMessage(doc);
};

IndexManager.prototype.addSync = function(doc, doCommit) {
    this.writer.addDocument(doc);
    if (doCommit !== false) {
        this.writer.commit();
        this.reopen();
    }
};

IndexManager.prototype.remove = function(name, value, doCommit) {
    var deleter = this.createWorker(function(event) {
        this.writer.deleteDocuments(event.data);
    }, doCommit);
    deleter.postMessage(new Term(name || "id", value));
};

IndexManager.prototype.removeSync = function(name, value, doCommit) {
    var term = new Term(name, value);
    this.writer.deleteDocuments(term);
    if (doCommit !== false) {
        this.writer.commit();
        this.reopen();
    }
};

IndexManager.prototype.update = function(name, value, doc, doCommit) {
    var updater = this.createWorker(function(event) {
        this.writer.updateDocument(event.data.term, event.data.document);
    }, doCommit);
    updater.postMessage({
        "term": new Term(name || "id", value),
        "document": doc
    });
};

IndexManager.prototype.updateSync = function(name, value, doc, doCommit) {
    var term = new Term(name || "id", value);
    this.writer.updateDocument(term, doc);
    if (doCommit !== false) {
        this.writer.commit();
        this.reopen();
    }
};

IndexManager.prototype.removeAll = function() {
    this.writer.deleteAll();
    this.writer.commit();
    this.reopen();
};

IndexManager.prototype.commit = function() {
    this.writer.commit();
    this.reopen();
};

IndexManager.prototype.createWorker = function(callback, doCommit) {
    var manager = this;
    var indexer = new Worker({
        "onmessage": function(event) {
            callback.call(manager, event);
            if (doCommit !== false) {
                manager.writer.commit();
                manager.reopen();
            }
        }
    });
    return indexer;
};
