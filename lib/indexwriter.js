/**
 * @fileoverview A Worker used to manipulate the underlying Lucene index.
 */
const log = require("ringo/logging").getLogger(module.id);
const {IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;

let indexWriter = null;
let timeoutId = null;

const onmessage = (event) => {
    const data = event.data;
    switch (data.type) {
        case "add":
            add(data.index, data.document);
            break;
        case "update":
            update(data.index, data.name, data.value, data.document);
            break;
        case "remove":
            remove(data.index, data.name, data.value);
            break;
        case "removeByQuery":
            removeByQuery(data.index, data.query);
            break;
        case "removeAll":
            removeAll(data.index);
            break;
        case "close":
            // intentionally empty: closing will be scheduled below, and executed
            // when no other jobs exist
            break;
        default:
            throw new Error("Unknown message type '" + data.type + "'");
    }
    event.source.postMessage({
        "type": event.data.type,
        "success": true
    });
    // schedule closing of the underlying index writer. this will post a
    // message to the caller when done.
    scheduleClose(event.source);
};

const getWriter = (index) => {
    if (indexWriter === null) {
        log.debug("Initializing index writer");
        const indexWriterConfig = new IndexWriterConfig(index.analyzer);
        indexWriterConfig.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
        indexWriter = new IndexWriter(index.directory, indexWriterConfig);
    }
    return indexWriter;
};

const scheduleClose = (source) => {
    if (timeoutId === null) {
        timeoutId = setTimeout(function() {
            close();
            source.postMessage({
                "type": "closed"
            });
            timeoutId = null;
        }, 30);
    }
};

const close = () => {
    if (indexWriter != null) {
        log.debug("Closing writer");
        indexWriter.close();
        indexWriter = null;
    }
    return true;
};

const add = (index, document) => {
    const writer = getWriter(index);
    if (Array.isArray(document)) {
        writer.addDocuments(new ScriptableList(document));
        log.debug("Added", document.length, "documents");
    } else {
        writer.addDocument(document);
        log.debug("Added document");
    }
    writer.commit();
};

const remove = (index, name, value) => {
    const writer = getWriter(index);
    writer["deleteDocuments(org.apache.lucene.index.Term[])"](new Term(name, value));
    log.debug("Removed documents", name, value);
};

const removeByQuery = (index, query) => {
    const writer = getWriter(index);
    writer["deleteDocuments(org.apache.lucene.search.Query[])"](query);
    log.debug("Removed documents by query", query);
};

const update = (index, name, value, document) => {
    const writer = getWriter(index);
    writer.updateDocument(new Term(name, value), document);
    log.debug("Updated document", name, value);
};

const removeAll = (index) => {
    const writer = getWriter(index);
    writer.deleteAll();
    // explicitly commit changes since the index has been cleared
    writer.commit();
};
