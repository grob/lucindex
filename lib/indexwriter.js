var engine = require("ringo/engine").getRhinoEngine();
var {Version} = org.apache.lucene.util;
var {IndexWriter, IndexWriterConfig, Term} = org.apache.lucene.index;
var {Document, Field} = org.apache.lucene.document;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;


var indexWriter = null;

function onmessage(event) {
    var data = event.data;
    var isFinished = false;
    switch (data.type) {
        case "add":
            isFinished = add(data.directory, data.analyzer, data.document);
            break;
        case "update":
            isFinished = update(data.directory, data.analyzer, data.name, data.value, data.document);
            break;
        case "remove":
            isFinished = remove(data.directory, data.analyzer, data.name, data.value);
            break;
        case "removeAll":
            isFinished = removeAll(data.directory, data.analyzer);
            break;
        case "close":
            isFinished = close();
            break;
        default:
            throw new Error("Unknown message type '" + data.type + "'");
    }
    if (isFinished === true) {
        event.source.postMessage({
            "type": data.type
        });
    }
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

var releaseWriter = function() {
    if (engine.getCurrentWorker().countScheduledTasks() == 0) {
        try {
            close();
            return true;
        } catch (e) {
            console.warn(e);
        }
    }
    return false;
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
    console.info("Adding document");
    try {
        if (Array.isArray(document)) {
            writer.addDocuments(document);
        } else {
            writer.addDocument(document);
        }
    } catch (e) {
        console.warn(e);
    }
    return releaseWriter();
};

var remove = function(directory, analyzer, name, value) {
    console.info("Removing documents", name, value);
    var writer = getWriter(directory, analyzer);
    try {
        writer.deleteDocuments(new Term(name, value));
    } catch (e) {
        console.warn(e);
    }
    return releaseWriter();
};

var update = function(directory, analyzer, name, value, document) {
    // console.info("Updating documents", name, value, document);
    var writer = getWriter(directory, analyzer);
    try {
        writer.updateDocument(new Term(name, value), document);
    } catch (e) {
        console.warn(e);
    }
    return releaseWriter();
};

var removeAll = function(directory, analyzer) {
    var writer = getWriter(directory, analyzer);
    try {
        writer.deleteAll();
        writer.commit();
    } catch (e) {
        console.warn(e);
    }
    return releaseWriter();
};
