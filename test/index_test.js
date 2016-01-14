var system = require("system");
var assert = require("assert");
var fs = require("fs");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");
var {Index} = require("../lib/main");
var {FSDirectory, RAMDirectory} = org.apache.lucene.store;
var {Document, Field, StringField} = org.apache.lucene.document;
var {MatchAllDocsQuery, BooleanQuery, BooleanClause, TermQuery} = org.apache.lucene.search;
var {Term} = org.apache.lucene.index;
var {Integer} = java.lang;
var utils = require("./utils");

var getSampleDocument = function(value) {
    var doc = new Document();
    doc.add(new StringField("id", value || 0, Field.Store.YES));
    return doc;
};

exports.testInitRamDirectory = function() {
    var dir = Index.initRamDirectory();
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof RAMDirectory);
};

exports.testInitDirectory = function() {
    var tempDir = utils.getTempDir();
    var dir = Index.initDirectory(tempDir, "test");
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof FSDirectory);
    tempDir["delete"]();
};

exports.testConstructor = function() {
    var manager = Index.createRamIndex();
    assert.isNotNull(manager);
    assert.isNotNull(manager.writer);
    assert.isNotNull(manager.reader);
    assert.isNotNull(manager.searcher);
    manager.close();
};

exports.testSize = function() {
    var manager = Index.createRamIndex();
    assert.strictEqual(manager.size(), 0);
    manager.close();
};

exports.testAddDocuments = function() {
    var manager = Index.createRamIndex();
    manager.add([getSampleDocument(1), getSampleDocument(2)]);
    utils.waitFor(function() {
        return manager.size() === 2;
    });
    manager.close();
};

exports.testRemoveByQuery = function() {
    var manager = Index.createRamIndex();
    var doc1 = new Document();
    doc1.add(new StringField("id", 1, Field.Store.YES));
    doc1.add(new StringField("type", "a", Field.Store.NO));
    var doc2 = new Document();
    doc2.add(new StringField("id", 1, Field.Store.YES));
    doc2.add(new StringField("type", "b", Field.Store.NO));
    manager.add([doc1, doc2]);
    utils.waitFor(function() {
        return manager.size() === 2;
    });
    var queryBuilder = new BooleanQuery.Builder();
    queryBuilder.add(new TermQuery(new Term("type", "a")), BooleanClause.Occur.MUST);
    queryBuilder.add(new TermQuery(new Term("id", 1)), BooleanClause.Occur.MUST);
    var query = queryBuilder.build();
    manager.removeByQuery(query);
    utils.waitFor(function() {
        return manager.size() === 1;
    });
};

exports.testConcurrentAsyncAdd = function() {
    var manager = Index.createRamIndex();
    // check size just to create a reader
    assert.strictEqual(manager.size(), 0);

    // starting 10 workers, each adding 10 documents
    var nrOfWorkers = 10;
    var docsPerWorker = 3;
    var docs = nrOfWorkers * docsPerWorker;
    var semaphore = new Semaphore();
    for (let i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker(module.resolve("./worker"));
        w.onmessage = function(event) {
            semaphore.signal();
        };
        w.postMessage({
            "action": "add",
            "manager": manager,
            "workerNr": i,
            "docsPerWorker": docsPerWorker,
            "getSampleDocument": getSampleDocument
        }, true);
    }
    // wait for all workers to finish
    semaphore.wait(nrOfWorkers);
    // wait until the async adds have finished
    utils.waitFor(function() {
        return manager.size() === docs;
    });
    assert.strictEqual(manager.size(), docs);
    manager.close();
};

exports.testConcurrentAsyncRemove = function() {
    var manager = Index.createRamIndex();
    assert.strictEqual(manager.size(), 0);

    var nrOfWorkers = 10;
    var docsPerWorker = 3;
    var docs = [];
    for (let i=0; i<nrOfWorkers; i+=1) {
        for (var j=0; j<docsPerWorker; j+=1) {
            docs.push(getSampleDocument((i * 10) + j));
        }
    }
    manager.add(docs);
    utils.waitFor(function() {
        return manager.size() == docs.length;
    });
    assert.strictEqual(manager.size(), docs.length);

    // starting 10 workers, each removing 10 documents
    var semaphore = new Semaphore();
    for (let i=0; i<nrOfWorkers; i+=1) {
        var w = new Worker(module.resolve("./worker"));
        w.onmessage = function(event) {
            semaphore.signal();
        };
        w.postMessage({
            "action": "remove",
            "manager": manager,
            "workerNr": i,
            "nrOfWorkers": nrOfWorkers,
            "docsPerWorker": docsPerWorker
        }, true);
    }
    // wait for all workers to finish
    semaphore.wait(nrOfWorkers);
    utils.waitFor(function() {
        return manager.size() === 0;
    });
    assert.strictEqual(manager.size(), 0);
    manager.close();
};

exports.testSearcherRefresh = function() {
    var manager = Index.createRamIndex();
    var searcher1 = manager.getSearcher();
    searcher1.search(new MatchAllDocsQuery(), Integer.MAX_VALUE);
    manager.releaseSearcher(searcher1);
    manager.add([getSampleDocument(1), getSampleDocument(2)]);
    utils.waitFor(function() {
        return manager.size() === 2;
    });
    var searcher2 = manager.getSearcher();
    assert.isFalse(searcher1.equals(searcher2))
    var result = searcher2.search(new MatchAllDocsQuery(), Integer.MAX_VALUE);
    assert.strictEqual(result.totalHits, 2);
    manager.releaseSearcher(searcher2);
};

if (require.main == module.id) {
    system.exit(require("test").run.apply(null,
            [exports].concat(system.args.slice(1))));
}
