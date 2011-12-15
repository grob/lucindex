var assert = require("assert");
var fs = require("fs");
var files = require("ringo/utils/files");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");
var {IndexManager} = require("../lib/indexmanager");
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {Document, Field} = org.apache.lucene.document;
var File = java.io.File;

var getTempDir = function() {
    var tempDir = new File(java.lang.System.getProperty("java.io.tmpdir"),
            "index" + java.lang.System.nanoTime());
    if (!tempDir.mkdir()) {
        throw new Error("Unable to create temporary index directory: " +
                tempDir.getAbsolutePath());
    }
    return tempDir;
};

var getDocument = function(value) {
    var doc = new Document();
    doc.add(new Field("id", value || 1,
             Field.Store.YES, Field.Index.ANALYZED, Field.TermVector.NO));
    return doc;
};

exports.testInitRamDirectory = function() {
    var dir = IndexManager.initRamDirectory();
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof RAMDirectory);
};

exports.testInitDirectory = function() {
    var tempDir = getTempDir();
    var dir = IndexManager.initDirectory("test", tempDir);
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof FSDirectory);
    tempDir["delete"]();
};

exports.testInitWriter = function() {
    var dir = IndexManager.initRamDirectory();
    var writer = IndexManager.initWriter(dir);
    assert.isNotNull(writer);
};

exports.testConstructor = function() {
    var manager = IndexManager.createRamIndex();
    assert.isNotNull(manager);
    assert.isNotNull(manager.writer);
    assert.isNotNull(manager.reader);
    assert.isNotNull(manager.searcher);
};

exports.testIndexer = function() {
    var manager = IndexManager.createRamIndex();
    assert.isFalse(manager.isRunning());
    assert.isTrue(manager.start());
    assert.isTrue(manager.isRunning());
    assert.isTrue(manager.stop());
    assert.isFalse(manager.stop());
    assert.isFalse(manager.isRunning());
};

exports.testSize = function() {
    var manager = IndexManager.createRamIndex();
    assert.strictEqual(manager.size(), 0);
};

exports.testAddSync = function() {
    var manager = IndexManager.createRamIndex();
    assert.isNotNull(manager.writer);
    assert.strictEqual(manager.size(), 0);
    manager.add(getDocument(1));
    assert.strictEqual(manager.size(), 1);
};

exports.testAddConcurrency = function() {
    var manager = IndexManager.createRamIndex();
    manager.start();

    // starting 10 workers, each adding 10 documents
    var nrOfWorkers = 10;
    var docsPerWorker = 10;
    var semaphore = new Semaphore();

    for (var i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker({
            "onmessage": function(event) {
                var workerNr = event.data;
                for (var i=0; i<docsPerWorker; i+=1) {
                    console.log("Adding document", workerNr, i);
                    manager.add(getDocument((workerNr * 10) + i));
                }
                semaphore.signal();
            }
        });
        w.postMessage(i, true);
    }

    // wait for all workers to finish
    semaphore.wait(nrOfWorkers);
    // FIXME: need a better way to determine when the manager has finished indexing
    java.lang.Thread.sleep(500);
    assert.strictEqual(manager.size(), nrOfWorkers * docsPerWorker);
    manager.stop();
};