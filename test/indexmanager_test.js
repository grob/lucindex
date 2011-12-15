var assert = require("assert");
var fs = require("fs");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");
var {IndexManager} = require("../lib/indexmanager");
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
var {Version} = org.apache.lucene.util;
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

var getSampleDocument = function(value) {
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
    var writer = IndexManager.initWriter(dir, new StandardAnalyzer(Version.LUCENE_35));
    assert.isNotNull(writer);
};

exports.testConstructor = function() {
    var manager = IndexManager.createRamIndex();
    assert.isNotNull(manager);
    assert.isNotNull(manager.writer);
    assert.isNotNull(manager.reader);
    assert.isNotNull(manager.searcher);
};

exports.testSize = function() {
    var manager = IndexManager.createRamIndex();
    assert.strictEqual(manager.size(), 0);
};

exports.testAddSync = function() {
    var manager = IndexManager.createRamIndex();
    assert.strictEqual(manager.size(), 0);
    // add document without commit
    manager.addSync(getSampleDocument(1), false);
    assert.strictEqual(manager.size(), 0);
    // add document with commit (default)
    manager.addSync(getSampleDocument(2));
    assert.strictEqual(manager.size(), 2);
};

exports.testConcurrentAsyncAdd = function() {
    var manager = IndexManager.createRamIndex();

    // starting 10 workers, each adding 10 documents
    var nrOfWorkers = 10;
    var docsPerWorker = 10;
    var semaphore = new Semaphore();
    for (var i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker({
            "onmessage": function(event) {
                var workerNr = event.data;
                for (var i=0; i<docsPerWorker; i+=1) {
                    manager.add(getSampleDocument((workerNr * 10) + i));
                }
                semaphore.signal();
            }
        });
        w.postMessage(i);
    }
    // wait for all workers to finish
    semaphore.wait(nrOfWorkers);
    // FIXME: how to determine if all async adds are finished?
    java.lang.Thread.sleep(100);
    assert.strictEqual(manager.size(), nrOfWorkers * docsPerWorker);
};

exports.testRemoveSync = function() {
    var manager = IndexManager.createRamIndex();
    assert.strictEqual(manager.size(), 0);
    manager.addSync(getSampleDocument(1));
    assert.strictEqual(manager.size(), 1);
    manager.removeSync("id", 1);
    assert.strictEqual(manager.size(), 0);
};

exports.testConcurrentAsyncRemove = function() {
    var manager = IndexManager.createRamIndex();
    var nrOfWorkers = 10;
    var docsPerWorker = 10;
    var docs = nrOfWorkers * docsPerWorker;
    for (var i=0; i<docs; i+=1) {
        manager.addSync(getSampleDocument(i), false);
    }
    manager.commit();
    assert.strictEqual(manager.size(), docs);

    // starting 10 workers, each removing 10 documents
    var semaphore = new Semaphore();
    for (var i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker({
            "onmessage": function(event) {
                var workerNr = event.data;
                for (var i=0; i<docsPerWorker; i+=1) {
                    manager.remove("id", (workerNr * 10) + i);
                }
                semaphore.signal();
            }
        });
        w.postMessage(i);
    }
    // wait for all workers to finish
    semaphore.wait(nrOfWorkers);
    // FIXME: how to determine if all async removals are finished?
    java.lang.Thread.sleep(100);
    assert.strictEqual(manager.size(), 0);
};
