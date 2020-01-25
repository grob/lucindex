const system = require("system");
const assert = require("assert");
const fs = require("fs");
const {Worker} = require("ringo/worker");
const {Semaphore} = require("ringo/concurrent");
const {Index} = require("../lib/main");
const {FSDirectory, RAMDirectory} = org.apache.lucene.store;
const {Document, Field, StringField} = org.apache.lucene.document;
const {MatchAllDocsQuery, BooleanQuery, BooleanClause, TermQuery} = org.apache.lucene.search;
const {Term} = org.apache.lucene.index;
const {Integer} = java.lang;
const utils = require("./utils");

const getSampleDocument = (value) => {
    const doc = new Document();
    doc.add(new StringField("id", value || 0, Field.Store.YES));
    return doc;
};

exports.testInitRamDirectory = () => {
    const dir = Index.initRamDirectory();
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof RAMDirectory);
};

exports.testInitDirectory = () => {
    const tempDir = utils.getTempDir();
    const dir = Index.initDirectory(tempDir, "test");
    assert.isNotNull(dir);
    assert.isTrue(dir instanceof FSDirectory);
    tempDir["delete"]();
};

exports.testConstructor = () => {
    const manager = Index.createRamIndex();
    assert.isNotNull(manager);
    assert.isNotNull(manager.writer);
    assert.isNotNull(manager.reader);
    assert.isNotNull(manager.searcher);
    manager.close();
};

exports.testSize = () => {
    const manager = Index.createRamIndex();
    assert.strictEqual(manager.size(), 0);
    manager.close();
};

exports.testAddDocuments = () => {
    const manager = Index.createRamIndex();
    manager.add([getSampleDocument(1), getSampleDocument(2)]);
    utils.waitFor(() => manager.size() === 2);
    manager.close();
};

exports.testRemoveByQuery = () => {
    const manager = Index.createRamIndex();
    const doc1 = new Document();
    doc1.add(new StringField("id", 1, Field.Store.YES));
    doc1.add(new StringField("type", "a", Field.Store.NO));
    const doc2 = new Document();
    doc2.add(new StringField("id", 1, Field.Store.YES));
    doc2.add(new StringField("type", "b", Field.Store.NO));
    manager.add([doc1, doc2]);
    utils.waitFor(() => manager.size() === 2);
    const queryBuilder = new BooleanQuery.Builder();
    queryBuilder.add(new TermQuery(new Term("type", "a")), BooleanClause.Occur.MUST);
    queryBuilder.add(new TermQuery(new Term("id", 1)), BooleanClause.Occur.MUST);
    const query = queryBuilder.build();
    manager.removeByQuery(query);
    utils.waitFor(() => manager.size() === 1);
};

exports.testConcurrentAsyncAdd = () => {
    const manager = Index.createRamIndex();
    // check size just to create a reader
    assert.strictEqual(manager.size(), 0);

    // starting 10 workers, each adding 10 documents
    const nrOfWorkers = 10;
    const docsPerWorker = 3;
    const docs = nrOfWorkers * docsPerWorker;
    const semaphore = new Semaphore();
    for (let i=0; i<nrOfWorkers; i+=1) {
        let w = new Worker(module.resolve("./worker"));
        w.onmessage = (event) => {
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
    utils.waitFor(() => manager.size() === docs);
    assert.strictEqual(manager.size(), docs);
    manager.close();
};

exports.testConcurrentAsyncRemove = () => {
    const manager = Index.createRamIndex();
    assert.strictEqual(manager.size(), 0);

    const nrOfWorkers = 10;
    const docsPerWorker = 3;
    const docs = [];
    for (let i=0; i<nrOfWorkers; i+=1) {
        for (let j=0; j<docsPerWorker; j+=1) {
            docs.push(getSampleDocument((i * 10) + j));
        }
    }
    manager.add(docs);
    utils.waitFor(() => manager.size() === docs.length);
    assert.strictEqual(manager.size(), docs.length);

    // starting 10 workers, each removing 10 documents
    const semaphore = new Semaphore();
    for (let i=0; i<nrOfWorkers; i+=1) {
        let w = new Worker(module.resolve("./worker"));
        w.onmessage = (event) => {
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
    utils.waitFor(() => manager.size() === 0);
    assert.strictEqual(manager.size(), 0);
    manager.close();
};

exports.testSearcherRefresh = () => {
    const index = Index.createRamIndex();
    const searcher1 = index.getSearcher();
    searcher1.search(new MatchAllDocsQuery(), Integer.MAX_VALUE);
    index.releaseSearcher(searcher1);
    index.add([getSampleDocument(1), getSampleDocument(2)]);
    utils.waitFor(() => index.size() === 2);
    const searcher2 = index.getSearcher();
    assert.isFalse(searcher1.equals(searcher2));
    const result = searcher2.search(new MatchAllDocsQuery(), Integer.MAX_VALUE);
    assert.strictEqual(result.totalHits.value, 2);
    index.releaseSearcher(searcher2);
};

if (require.main == module.id) {
    system.exit(require("test").run.apply(null,
            [exports].concat(system.args.slice(1))));
}
