/**
 * @fileoverview A Worker used to manipulate the underlying Lucene index.
 */
var log = require("ringo/logging").getLogger(module.id);
var {Version} = org.apache.lucene.util;
var {IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

var indexWriter = null;
var timeoutId = null;

function onmessage(event) {
    var data = event.data;
    switch (data.type) {
        case "add":
            add(data.directory, data.analyzer, data.document);
            break;
        case "update":
            update(data.directory, data.analyzer, data.name, data.value, data.document);
            break;
        case "remove":
            remove(data.directory, data.analyzer, data.name, data.value);
            break;
        case "removeAll":
            removeAll(data.directory, data.analyzer);
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

var getWriter = function(directory, analyzer) {
    if (indexWriter == null) {
        log.debug("Initializing index writer");
        var indexWriterConfig = new IndexWriterConfig(Version.LUCENE_47, analyzer ||
                new StandardAnalyzer(Version.LUCENE_47));
        indexWriterConfig.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
        indexWriter = new IndexWriter(directory, indexWriterConfig);
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

var add = function(directory, analyzer, document) {
    var writer = getWriter(directory, analyzer);
    if (Array.isArray(document)) {
        writer.addDocuments(new ScriptableList(document));
        log.debug("Added", document.length, "documents");
    } else {
        writer.addDocument(document);
        log.debug("Added document");
    }
};

var remove = function(directory, analyzer, name, value) {
    var writer = getWriter(directory, analyzer);
    writer.deleteDocuments(new Term(name, value));
    log.debug("Removed documents", name, value);
};

var update = function(directory, analyzer, name, value, document) {
    var writer = getWriter(directory, analyzer);
    writer.updateDocument(new Term(name, value), document);
    log.debug("Updated document", name, value);
};

var removeAll = function(directory, analyzer) {
    var writer = getWriter(directory, analyzer);
    writer.deleteAll();
    // explicitly commit changes since the index has been cleared
    writer.commit();
};
