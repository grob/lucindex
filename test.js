var {Index} = require("lucindex/lib/index");
var analyzerFactory = require("lucindex/lib/analyzer");
var sa = analyzerFactory.createStandardAnalyzer("LUCENE_42");
var idx = Index.createIndex("/tmp/", "testindex", sa, {
    version: "LUCENE_42", 
    meta: {id: {type: "int", store: true}, count: {type: "float", store: true}, name: {store: true}}
    });
print("size: " + idx.size());

idx.removeAll();
java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var doc = idx.createDocument({id: 2, name: "hombre", count: 5.3})

idx.update("count", 5.3, doc);
idx.update("count", 5.3, doc);


java.lang.Thread.sleep(1000);

print("size: " + idx.size());

var result = idx.query("name", "homb*");
print(result.size());
for (var i = 0; i < result.size(); i++) {
    print (JSON.stringify(result.get(i)));
};