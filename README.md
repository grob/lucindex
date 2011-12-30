## About Lucindex

Lucindex is a lightweight wrapper around [Apache Lucene] for [RingoJS]. It provides basic functionality for creating disk- and memory-based search indexes as well as asynchronously adding/updating/removing documents.

## Status

Lucindex is experimental beta, so expect bugs and performance issues as well as significant API changes.

## Documentation

### Index Initialization

Lucindex supports creating either memory- or disk-stored search indexes. Initializing an index is a matter of a few lines:

    var {Index} = require("lucindex");
    var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
    var {Version} = org.apache.lucene.util;
    var analyzer = new StandardAnalyzer(Version.LUCENE_35);

    // creating a disk-persisted search index
    var index = Index.createIndex("/path/to/index/basedirectory", "nameofindex", analyzer)

    // creating a RAM search index
    var index = Index.createRamIndex(analyzer);

    // in most situations it's probably best to instantiate the index manager as singleton
    var index = exports.index = module.singleton("index", function() {
        return Index.createRamIndex(analyzer);
    });

### Adding/Updating/Removing Documents

    var {Document, Field} = org.apache.lucene.document;

    // create a new document instance with two fields ("id" and "name")
    var doc = new Document();
    doc.add(new Field("id", 1,
                Field.Store.YES, Field.Index.NOT_ANALYZED, Field.TermVector.NO));
    doc.add(new Field("name", "Lucindex for RingoJS",
                Field.Store.NO, Field.Index.ANALYZED, Field.TermVector.NO));

    // add the document to the index. NOTE: this is done asynchronously
    index.add(doc);

    // asynchronously replace the document with id 1 with another one
    var doc = new Document();
    doc.add(new Field("id", 1,
                Field.Store.YES, Field.Index.NOT_ANALYZED, Field.TermVector.NO));
    doc.add(new Field("name", "Ringo SqlStore",
                Field.Store.NO, Field.Index.ANALYZED, Field.TermVector.NO));
    index.update("id", 1, doc);

    // asynchronously remove the document again
    index.remove("id", 1);

### Searching

    var {QueryParser} = org.apache.lucene.queryParser;
    var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
    var {Version} = org.apache.lucene.util;
    var analyzer = new StandardAnalyzer(Version.LUCENE_35);
    var queryParser = new QueryParser(Version.LUCENE_35, "name", analyzer);
    var query = queryParser.parse("my query string");

    // returns the 20 best matches for the above query string
    var topDocs = index.searcher.search(query, null, 20);


 [Apache Lucene]: http://lucene.apache.org/java/
 [RingoJS]: http://github.com/ringo/ringojs/
