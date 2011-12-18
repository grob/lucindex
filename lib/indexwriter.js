var {setTimeout} = require("ringo/scheduler");
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
        console.info("Creating writer");
        try {
            var indexWriterConfig = new IndexWriterConfig(Version.LUCENE_35, analyzer ||
                    new StandardAnalyzer(Version.LUCENE_35));
            indexWriterConfig.setOpenMode(IndexWriterConfig.OpenMode.CREATE_OR_APPEND);
            indexWriter = new IndexWriter(directory, indexWriterConfig);
        } catch (e) {
            console.warn(e);
        }
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
        }, 0);
    }
};

var close = function() {
    if (indexWriter != null) {
        console.info("Closing writer");
        indexWriter.close();
        indexWriter = null;
    }
    return true;
};

var add = function(directory, analyzer, document) {
    var writer = getWriter(directory, analyzer);
    try {
        if (Array.isArray(document)) {
            console.info("Adding", document.length, "documents");
            writer.addDocuments(document);
        } else {
            console.info("Adding document");
            writer.addDocument(document);
        }
    } catch (e) {
        console.warn(e);
    }
};

var remove = function(directory, analyzer, name, value) {
    console.info("Removing documents", name, value);
    var writer = getWriter(directory, analyzer);
    try {
        writer.deleteDocuments(new Term(name, value));
    } catch (e) {
        console.warn(e);
    }
};

var update = function(directory, analyzer, name, value, document) {
    // console.info("Updating documents", name, value, document);
    var writer = getWriter(directory, analyzer);
    try {
        writer.updateDocument(new Term(name, value), document);
    } catch (e) {
        console.warn(e);
    }
};

var removeAll = function(directory, analyzer) {
    var writer = getWriter(directory, analyzer);
    try {
        writer.deleteAll();
        writer.commit();
    } catch (e) {
        console.warn(e);
    }
};
