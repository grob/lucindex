## About Lucindex

Lucindex is a lightweight wrapper around [Apache Lucene] for [RingoJS]. It provides basic functionality for creating disk- and memory-based search indexes as well as asynchronously adding/updating/removing documents.

## Status

Although Lucindex is pre-1.0, it has been used in production in various applications for several years now. Nevertheless chances are that on the way to version 1.0 there will be incompatible API changes.

## Documentation

### Index Initialization

Lucindex supports creating either memory- or disk-stored search indexes. Initializing an index is a matter of a few lines:

    var {Index} = require("lucindex");
    var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
    var {Version} = org.apache.lucene.util;
    var analyzer = new StandardAnalyzer();

    // creating a disk-persisted search index
    var index = Index.createIndex("/path/to/index/basedirectory", "nameofindex", analyzer)

    // creating a RAM search index
    var index = Index.createRamIndex(analyzer);

    // in most situations it's probably best to instantiate the index manager as singleton
    var index = exports.index = module.singleton("index", function() {
        return Index.createRamIndex(analyzer);
    });

### Adding/Updating/Removing Documents

    var {Document, Field, NumericDocValuesField,
            StoredField, StringField, TextField} = org.apache.lucene.document;

    // create a new document instance with two fields ("id" and "name")
    var id = 1;
    var name = "Lucindex for RingoJS";
    var doc = new Document();
    // index id as stored numeric field
    doc.add(new NumericDocValuesField("id", id));
    doc.add(new StoredField("id", id));
    // plus index id as string field so that searching for it works too
    doc.add(new StringField("id", id.toString(), Field.Store.NO));
    doc.add(new TextField("name", name, Field.Store.NO));

    // add the document to the index. NOTE: this is done asynchronously
    index.add(doc);

    // asynchronously replace the document with id 1 with another one
    var doc = new Document();
    // index id as stored numeric field
    doc.add(new NumericDocValuesField("id", id));
    doc.add(new StoredField("id", id));
    // plus index id as string field so that searching for it works too
    doc.add(new StringField("id", id.toString(), Field.Store.NO));
    doc.add(new TextField("name", "Ringo SqlStore", Field.Store.NO));
    index.update("id", id, doc);

    // asynchronously remove the document again
    index.remove("id", id);

### Searching

    var {QueryParser} = org.apache.lucene.queryparser.classic;
    var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
    var analyzer = new StandardAnalyzer();
    var queryParser = new QueryParser("name", analyzer);
    var query = queryParser.parse("ringo");

    // returns the 20 best matches for the above query string
    var searcher = index.getSearcher();
    var topDocs = searcher.search(query, null, 20);
    
    // process search hit
    var doc = index.reader.document(topDocs.scoreDocs[0].doc);
    var id = doc.getField("id").numericValue();
    console.log("ID:", id);
    
    // release the searcher again
    index.releaseSearcher(searcher);


 [Apache Lucene]: http://lucene.apache.org/java/
 [RingoJS]: http://github.com/ringo/ringojs/

### SimpleIndex

SimpleIndex is a wrapper around an Index adding type-definitions to the fields stored within the index. Those type-definitions take care of converting the javascript-values to Lucene-specific values (i.e. an integer value has to be converted to a ByteRef to make it useable for range queries and also to use the field carrying the int-value as key for update/remove).

Currently existing fields:
- `DefaultField`: treating values as lucene TextFields and creating queries with the default queryparser.
- `TextField`: also treating values as TextFields, but creating a WildcardQuery
- `DoubleField`, `IntField`, `LongField`: converting to Lucene ByteRef instances and enabling numeric range queries
- `DateField` converting date values to long values and using LongField for interaction with the index
- `StringField` treating values as Lucene StringField (no tokenization and only exact matches possible)

#### Using SimpleIndex:

    var {Index} = require("lucindex");
    var {SimpleIndex} = require("lucindex/simpleindex");
    var {IntField, TextField, DateField} = require("lucindex/fields");
    var {QueryBuilder} = require("lucindex/querybuilder");
    var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
    var analyzer = new StandardAnalyzer();

    // creating a disk-persisted search index
    var index = Index.createIndex("/path/to/index/basedirectory", "nameofindex", analyzer)
    
    var si = new SimpleIndex(index, {
        defaultField: "name",
        id: new IntField({name: "id", store: true}),
        name: new TextField({name: "name", store: false}),
        createtime: new DateField({name: "createtime", store: false})
    });

    si.add(si.createDocument({
        id: 1,
        name: "max mustermann",
        createtime: "2014-01-01T14:23:00.000Z"
    }));
    si.add(si.createDocument({
        id: 2,
        name: "horst friedrich",
        createtime: new Date()
    }));
    si.update("id", 1, si.createDocument({
        id: 1,
        name: "maximilian mustermann",
        createtime: new Date()
    }));

    var queryBuilder = new QueryBuilder(si);
    queryBuilder.must("name", "muster*");
    var result = si.query(queryBuilder.getQuery());
    // hits will be 1 in this case
    var hits = result.topdocs.totalHits;
    // jsDoc will be a javascript-object like {id: 1, name: "max mustermann", createtime: "2014-01-01T14:23:00.000Z"}
    // where the createtime will be an actual javascript date
    var jsDoc = si.convertDocument(result.searcher.doc(result.topdocs.scoreDocs[0].doc));
