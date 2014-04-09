
var assert = require("assert");
var {Index, SimpleIndex, QueryBuilder} = require("../lib/main");
var {TextField, DoubleField, IntField, DateField, LongField, StringField} = require("../lib/fields");
var {MatchAllDocsQuery} = org.apache.lucene.search;

var waitFor = function(callback) {
    var timeout = java.lang.System.currentTimeMillis() + 2000;
    while (callback() == false) {
        if (java.lang.System.currentTimeMillis() < timeout) {
            java.lang.Thread.currentThread().sleep(100);
        } else {
            throw new Error("Timeout");
        }
    }
    return true;
};

var index;

exports.setUp = function() {
    index = Index.createRamIndex();
};

exports.tearDown = function() {
    index.close();
    delete index;
};

exports.testCreate = function() {
    assert.throws(function() {
        new SimpleIndex()
        }, Error);
    var si = new SimpleIndex(index, {defaultField: "field"});
    assert.ok(si);
};

exports.testAdd = function() {
    var si = new SimpleIndex(index, {defaultField: "doubleField",
        doubleField: new DoubleField({name: "doubleField", store: true}),
        intField: new StringField({name: "intField", store: true}),
        dateField: new StringField({name: "dateField", store: true, resolution: "DAY"}),
        longField: new StringField({name: "longField", store: true}),
        stringField: new StringField({name: "stringField", store: true})
    });
    for each (var doc in [
                          {doubleField: 1.2, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"},
                          {doubleField: 2.4, intField: 2, dateField: new Date(2014, 0, 2, 21, 9), longField: 4, stringField: "zwei"}]) {
        si.add(doc);
    }
    waitFor(function() {
        return si.size() == 2;
    });
    query(si, [{query: new MatchAllDocsQuery(), 
        hits: 2, expected: [{doubleField: 1.2, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"},
                            {doubleField: 2.4, intField: 2, dateField: new Date(2014, 0, 2, 21, 9), longField: 4, stringField: "zwei"}]}]);
};

var updateTestSetup = function() {
    var si = new SimpleIndex(index, {defaultField: "doubleField",
        doubleField: new DoubleField({name: "doubleField", store: true}),
        intField: new IntField({name: "intField", store: true}),
        dateField: new DateField({name: "dateField", store: true, resolution: "DAY"}),
        longField: new LongField({name: "longField", store: true}),
        stringField: new StringField({name: "stringField", store: true})
    });
    for each (var doc in [
                          {doubleField: 1.2, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"},
                          {doubleField: 2.4, intField: 2, dateField: new Date(2014, 0, 2, 21, 9), longField: 4, stringField: "zwei"}]) {
        si.add(doc);
    }
    waitFor(function() {
        return si.size() == 2;
    });
    query(si, [{query: new MatchAllDocsQuery(), 
        hits: 2, expected: [{doubleField: 1.2, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 3, stringField: "eins"},
                            {doubleField: 2.4, intField: 2, dateField: new Date(2014, 0, 2, 0, 0, 0, 0), longField: 4, stringField: "zwei"}]}]);
    return si;
}

exports.testUpdateDouble = function() {
    var si = updateTestSetup();
    si.update("doubleField", 1.2, {doubleField: 1.2, intField: 3, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"});
    java.lang.Thread.sleep(1000);
    assert.equal(si.size(), 2);
    query(si, [{query: {doubleField: 1.2}, 
        hits: 1, expected: [{doubleField: 1.2, intField: 3, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 3, stringField: "eins"}]}]);
};

exports.testUpdateInt = function() {
    var si = updateTestSetup();
    si.update("intField", 1, {doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"});
    java.lang.Thread.sleep(1000);
    assert.equal(si.size(), 2);
    query(si, [{query: {intField: 1}, 
        hits: 1, expected: [{doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 3, stringField: "eins"}]}]);
};

exports.testUpdateDate = function() {
    var si = updateTestSetup();
    si.update("dateField", new Date(2014, 0, 1, 23, 8), {doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"});
    java.lang.Thread.sleep(1000);
    assert.equal(si.size(), 2);
    query(si, [{query: {dateField: new Date(2014, 0, 1, 23, 8)}, 
        hits: 1, expected: [{doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 3, stringField: "eins"}]}]);
};

exports.testUpdateString = function() {
    var si = updateTestSetup();
    si.update("stringField", "eins", {doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 3, stringField: "eins"});
    java.lang.Thread.sleep(1000);
    assert.equal(si.size(), 2);
    query(si, [{query: {stringField: "eins"}, 
        hits: 1, expected: [{doubleField: 1.3, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 3, stringField: "eins"}]}]);
};

exports.testQueryDouble = function() {
    query(querySetup(), [{query: {doubleField: 1.1},
            hits: 1, expected: [{doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 1, stringField: "eins"}]},
                         {query: {doubleField: {min: 2.2, max: 3.3}},
            hits: 2, expected: [{doubleField: 2.2, intField: 2, dateField: new Date(2014, 0, 2, 0, 0, 0, 0), longField: 2, stringField: "zwei"},
                                {doubleField: 3.3, intField: 3, dateField: new Date(2014, 0, 3, 0, 0, 0, 0), longField: 3, stringField: "drei"}]}]);

};

exports.testQueryInt = function() {
    query(querySetup(), [{query: {intField: 1},
            hits: 1, expected: [{doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 1, stringField: "eins"}]},
                         {query: {intField: {min: 2, max: 3}},
            hits: 2, expected: [{doubleField: 2.2, intField: 2, dateField: new Date(2014, 0, 2, 0, 0, 0, 0), longField: 2, stringField: "zwei"},
                                {doubleField: 3.3, intField: 3, dateField: new Date(2014, 0, 3, 0, 0, 0, 0), longField: 3, stringField: "drei"}]}]);

};

exports.testQueryDate = function() {
    query(querySetup(), [{query: {dateField: new Date(2014, 0, 1, 10, 8)}, 
            hits: 1, expected: [{doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 1, stringField: "eins"}]},
                         {query: {dateField: {min: new Date(2014, 0, 2, 21, 9), max: new Date(2014, 0, 3, 21, 9)}},
            hits: 2, expected: [{doubleField: 2.2, intField: 2, dateField: new Date(2014, 0, 2, 0, 0, 0, 0), longField: 2, stringField: "zwei"},
                                {doubleField: 3.3, intField: 3, dateField: new Date(2014, 0, 3, 0, 0, 0, 0), longField: 3, stringField: "drei"}]}]);
};

exports.testQueryLong = function() {
    query(querySetup(), [{query: {longField: 1}, 
            hits: 1, expected: [{doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 1, stringField: "eins"}]},
                         {query: {longField: {min: 2, max: 3}}, 
            hits: 2, expected: [{doubleField: 2.2, intField: 2, dateField: new Date(2014, 0, 2, 0, 0, 0, 0), longField: 2, stringField: "zwei"},
                                {doubleField: 3.3, intField: 3, dateField: new Date(2014, 0, 3, 0, 0, 0, 0), longField: 3, stringField: "drei"}]}]);
};

exports.testQueryString = function() {
    query(querySetup(), [{query: {stringField: "eins"}, 
            hits: 1, expected: [{doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 0, 0, 0, 0), longField: 1, stringField: "eins"}]}]);
};

exports.testQueryInvalid = function() {
    var si = querySetup();
    assert.throws(function() {
        si.query();
    });
    assert.throws(function() {
        si.query("invalid stuff");
    });
};

var query = function(si, arr) {
    for each (var qry in arr) {
        var query;
        if (typeof(qry.query) == "object" && qry.query.class && qry.query.class.toString().indexOf("org.apache.lucene.search.") > -1) {
            query = qry.query;
        } else {
            var qb = new QueryBuilder(si);
            for (var i in qry.query) {
                qb.should(i, qry.query[i]);
            }
            query = qb.getQuery();
        }
        var result = si.query(query);
        assert.equal(result.topdocs.totalHits, qry.hits);
        si.index.releaseSearcher(result.searcher);
        assert.isTrue(expectedQueryResult(si, result, qry.expected));
    }
};

var querySetup = function() {
    var si = new SimpleIndex(index, {defaultField: "doubleField",
        doubleField: new DoubleField({name: "doubleField", store: true}),
        intField: new IntField({name: "intField", store: true}),
        dateField: new DateField({name: "dateField", store: true, resolution: "DAY"}),
        longField: new LongField({name: "longField", store: true}),
        stringField: new StringField({name: "stringField", store: true})
    });
    for each (var doc in [
                          {doubleField: 1.1, intField: 1, dateField: new Date(2014, 0, 1, 23, 8), longField: 1, stringField: "eins"},
                          {doubleField: 2.2, intField: 2, dateField: new Date(2014, 0, 2, 21, 9), longField: 2, stringField: "zwei"},
                          {doubleField: 3.3, intField: 3, dateField: new Date(2014, 0, 3, 21, 9), longField: 3, stringField: "drei"},
                          {doubleField: 5.3, intField: 4, dateField: new Date(2014, 0, 4, 21, 9), longField: 4, stringField: "vier"}]) {
        si.add(doc);
    }
    waitFor(function() {
        return si.size() == 4;
    });
    return si;
};

var expectedQueryResult = function(si, result, values) {
    if (result.topdocs.totalHits != values.length) {
        return false;
    }
    for (var i = 0; i < values.length; i++) {
        var currVal = values[i], currResult = result.searcher.doc(result.topdocs.scoreDocs[i].doc);
        for (var prop in values[i]) {
            assert.deepEqual(si.convertDocument(currResult), currVal);
        }
    }
    return true;
};