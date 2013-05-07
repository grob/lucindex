/**
 * @fileoverview A Worker used to manipulate the underlying Lucene index.
 */
var log = require("ringo/logging").getLogger(module.id);
var {IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;


var indexWriter = null;
var timeoutId = null;

function onmessage(event) {
    var data = event.data;
    switch (data.type) {
        case "add":
            add(data.index, data.document);
            break;
        case "update":
            update(data.index, data.term, data.document);
            break;
        case "remove":
            remove(data.index, data.term);
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
}

var getWriter = function(index) {
    if (indexWriter == null) {
        log.debug("Initializing index writer");
        var indexWriterConfig = new IndexWriterConfig(index.version, index.analyzer);
        indexWriterConfig.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
        indexWriter = new IndexWriter(index.directory, indexWriterConfig);
    }
    return indexWriter;
};

var scheduleClose = function(source) {
    if (timeoutId == null) {
        timeoutId = setTimeout(function() {
            close();
            source.postMessage({
                "type": "closed"
            });
            timeoutId = null;
        }, 30);
    }
};

var close = function() {
    if (indexWriter != null) {
        log.debug("Closing writer");
        indexWriter.close();
        indexWriter = null;
    }
    return true;
};

var add = function(index, document) {
    var writer = getWriter(index);
    if (Array.isArray(document)) {
        log.debug("Adding", document.length, "documents");
        writer.addDocuments(document);
    } else {
        log.debug("Adding document");
        writer.addDocument(document);
    }
};

var remove = function(index, term) {
    log.debug("Removing documents", name, value);
    var writer = getWriter(index);
    writer.deleteDocuments(term);
};

var update = function(index, term, document) {
    log.debug("Updating document", term);
    var writer = getWriter(index);
    writer.updateDocument(term, document);
};

var removeAll = function(index) {
    var writer = getWriter(index);
    writer.deleteAll();
    // explicitly commit changes since the index has been cleared
    writer.commit();
};
