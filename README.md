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

### SimpleIndex

SimpleIndex is a wrapper around a lucindex Index adding type-definitions to the fields
stored within the index. Those type-definitions take care of converting the javascript-
values to lucene-understandable-values.

e.g. an integer value has to be converted to a ByteRef to make it useable for range-
queries and also to use the field carrying the int-value as key for update/remove.

Currently existing fields:
DefaultField treating values as lucene TextFields and creating queries with the default queryparser.
TextField also treating values as TextFields creating a WildcardQuery
DoubleField, IntField, LongField converting to lucene-understandable ByteRef instances and enabling numeric rangequeries
DateField converting date-values to long values and using LongField for interaction with the index
StringField treating values as lucene StringField (no tokenization and only exact matches possible)

Using SimpleIndex:
var index = Create a lucindex Index with your desired analyzer and version. (see above)
var si = new SimpleIndex(index, {
   defaultField: "name",
   id: new IntField({name: "id", store: true}),
   name: new TextField({name: "name", store: false}),
   createtime: new DateField({name: "createtime", store: false})
});

si.add(si.createDocument({id: 1, name: "max mustermann", createtime: "2014-01-01T14:23:00.000Z"}));
si.add(si.createDocument({id: 2, name: "horst friedrich", createtime: new Date()}));
si.update("id", 1, si.createDocument({id: 1, name: "maximilian mustermann", createtime: new Date()});

var result = si.query(si.createQuery({name: "muster*"});
// hits will be 1 in this case
var hits = result.topdocs.totalhits;
// jsDoc will be a javascript-object like {id: 1, name: "max mustermann", createtime: "2014-01-01T14:23:00.000Z"}
// where the createtime will be an actual javascript date
var jsDoc = si.convertDocument(result.searcher.doc(result.topdocs.scoreDoc[0].doc));