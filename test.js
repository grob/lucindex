var logging = require("ringo/logging");
logging.setConfig(getResource(module.resolve("./log4j.properties")));
var log = logging.getLogger(module.id);

var {Index, SimpleIndex, analyzerFactory} = require("./lib/main");
var VER = "LUCENE_47";
var sa = analyzerFactory.createStandardAnalyzer(VER);

var pa = analyzerFactory.createLanguageSpecificAnalyzer("de", {version: VER});
var analyzer = analyzerFactory.createPerFieldAnalyzer({"name": pa, "address": pa}, sa);
// var analyzer = sa;

var rawidx = Index.createIndex("/tmp/", "testindex", analyzer, VER);
var idx = new SimpleIndex(rawidx, 
        {meta: 
            {id: {type: "int", store: true}, 
             count: {type: "float", store: true}, 
             name: {store: true}, address: {store: false}}});
print("size: " + idx.size());

idx.removeAll();
java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var docs = [{id: 1, name: "bernd", count: 5.3, address: "Mustergasse 8"},
            {id: 2, name: "tom", count: 7.3, address: "Musterstraﬂe 9"},
            {id: 3, name: "christian", count: 5.3, address: "Silbergasse 14"},
            {id: 4, name: "robert", count: 5.3, address: "Mariahilferstraﬂe 1"},
            {id: 5, name: "marius", count: 5.3, address: "Am Graben 9"},
            {id: 6, name: "manius", count: 5.3, address: "Hufeisengasse"}];

for each (var doc in docs)
    idx.add(doc);

java.lang.Thread.sleep(1000);
print("size: " + idx.size());

idx.update("id", 1, {id: 1, name: "berndi", count: 5.2, address: "Mustergasse 8"});

java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var result = idx.query(["name", "address"], "ma?ius");
print(result.size());
for (var i = 0; i < result.size(); i++) {
    print (JSON.stringify(result.get(i)));
};

result = idx.query("count", 5.3);
print(result.size());
for (var i = 0; i < result.size(); i++) {
    print (JSON.stringify(result.get(i)));
};
