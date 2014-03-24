var utils = require("./utils");
var log = require("ringo/logging").getLogger(module.id);
var {QueryParser, MultiFieldQueryParser} = org.apache.lucene.queryparser.classic;
var {Document, DoubleField, FloatField, IntField, LongField, StringField, TextField, Field} = org.apache.lucene.document;
var {BooleanQuery, BooleanClause, WildcardQuery, NumericRangeQuery, TermQuery, PhraseQuery} = org.apache.lucene.search;
var {Term} = org.apache.lucene.index;
var {Index} = require("./index.js");
var strings = require("ringo/utils/strings");

/**
 * Create a convenient index wrapping a plain index and combining it with some
 * meta-information about the fields the index will store/stores
 * 
 * Metainformation is defined as javascript object containing all
 * fields as properties.
 * Each field also describes the value stored as javascript object and
 * may contain the following information:
 * - type: int, double, float, long, string, text, date
 *         string will not be tokenized and only the whole string will match
 *         date is a special type converting the date to a long to make rangequeries possible.
 *         Dates will also be autotranslated if used in queries.
 * - store: true | false causing the field to be either stored within the index or not.
 *          only stored fields may be retrieved from query-results. it's a good idea to
 *          limit this to e.g. the database-id of the record found or the index will get
 *          fairly big if every field is stored within lucene.
 * - resolution: YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, MILLISECOND(default) cutting down
 *               the resolution of a date and is therefore only viable as property if
 *               type == date.
 * @class Creates a convenient wrapper around Index enabling fields to be typed and easing querying the index based on typed fields
 * @param index the index to wrap
 * @param meta an object describing the fields available in documents (their type and if they are stored)
 * @constructor
 */
var SimpleIndex = exports.SimpleIndex = function(index, meta) {
    if (!config.meta || !config.meta.defaultField)
        throw new Error("no metadata describing the index. minimum required is the meta.defaultField.");
    Object.defineProperties(this, {
        "index": {
            "value": index,
            "writeable": false
        },
        "meta": {
            "value": meta || {},
            "writeable": false
        }
    });
};

/**
 * Creates a lucene-document with the provided data using autoconversion which has been defined
 * on construction time of this simpleindex object
 * @param data a plain javascript object holding the values
 */
SimpleIndex.prototype.createDocument = function(data) {
    var doc = new Document();
    for (var i in data) {
        doc.add(createField(i, data[i], this.meta[i]));
    }
    return doc;
};

/**
 * Creates a lucene documentfield using the meta-data provided on
 * construction of this simpleindex. all values will be autoconverted
 * to the apropriate fields for their configuread value-type. e.g.
 * IntField for int-values, DoubleField for double-values...
 * date is a special case converting dates to long-values to make range
 * queries possible for dates.
 * @param name the name of the lucene documentfield
 * @param value the value this lucene documentfiled should have
 * @param meta the metainformation defined for this field
 */
var createField = function(name, value, meta) {
    var type = "text";
    var store = Field.Store.NO;
    if (meta) {
        type = meta.type || "text";
        store = meta.store ? Field.Store.YES : Field.Store.NO;
    }
    switch(type) {
    case "double":
    case "float":
        return new DoubleField(name, value, store);
    case "int":
        return new IntField(name, value, store);
    case "date":
        var dat = convertDate(value, meta);
        if (dat == null) {
            throw new Error("SimpleIndex got date-field " + name + " but value isn't a date: " + value);
        }
        value = dat.getTime();
    case "long":
        return new LongField(name, value, store);
    case "string": // Strings aren't tokenized. use it for id's or fixed values
                   // like options from a selectbox
        return new StringField(name, fieldToString(value, meta), store);
    case "text":
    default:
        return new TextField(name, fieldToString(value, meta), store);
    };
};

/**
 * Helper converting arbitrary values into a string-representation
 * @param val the value to convert to a string
 * @param meta the metainformation defined for this field
 */
var fieldToString = function(val, meta) {
    switch(typeof(val)) {
    case null:
    case "undefined":
        return null;
    case "string":
        return val;
    case "number":
        return ""+val;
    case "object":
        if (Object.prototype.toString.call(val) === "[object Date]") {
            DateTools.dateToString(val, DateTools.Resolution[meta ? (meta.resolution || "MINUTE") : "MINUTE"]);
        }
        return val.toString();
    case "boolean":
        return val ? "true" : "false"
    }
    throw new Error("how is that possible? unknown type " + typeof(val));
};

/**
 * Encodes numeric values to use them for queries depending on the metainformation given
 * @param value the value to encode
 * @param meta the metainformation defined for this field
 */
var encodeValue = function(value, meta) {
    if (!meta || !meta.type) {
        return value;
    }
    switch(meta.type) {
    case "int":
        return utils.prepareIntValue(value);
    case "double":
    case "float":   // unfortunately java-float-primitives
                    // converted to JS are not working correctly
                    // so we use double value instead
        return utils.prepareDoubleValue(value);
    case "long":
        return utils.prepareLongValue(value);
    }
    // no idea what to do with given type
    log.warn("SimpleIndex encodeValue encountered an unknown field-type:", meta.type);
    return value;
};

/**
 * Remove the document from the index having the given value. value will be autoconverted to
 * it's lucene-native form
 * @param field the field which must have the given value to identify the document to remove
 * @param value the value the given field must have to identify the document to remove
 */
SimpleIndex.prototype.remove = function(field, value) {
    return this.index.remove(field, 
            encodeValue(value, this.meta[field]));
};

/**
 * Update the document where field has the value with the given data.
 * @param field the field which must have the given value to identify the document to update
 * @param value the value the given field must have to identify the document to update
 * @param data the javascript object holding the new values for this document
 */
SimpleIndex.prototype.update = function(field, value, data) {
    return this.index.update(field, 
            encodeValue(value, this.meta[field]), this.createDocument(data));
};

/**
 * Add this new document to the index. NOTE: if ther is already a document
 * contained having the same values, this will result in a duplicate record
 * @param data the javascript object holding the values for this new document
 */
SimpleIndex.prototype.add = function(data) {
    return this.index.add(this.createDocument(data));
};

/**
 * Removes all documents from the index
 */
SimpleIndex.prototype.removeAll = function()  {
    return this.index.removeAll();
};

/**
 * Close this index down.
 */
SimpleIndex.prototype.close = function() {
    return this.index.close();
};

/**
 * Get the size of this index (the number of documents contained)
 */
SimpleIndex.prototype.size = function() {
    return this.index.size();
};

/**
 * Convenience function returning a Result-Object holding all retrieved documents
 * @param query the lucene query-object used to search the index
 * @param limit the maximum number of document retrieved (defaults to 50)
 */
SimpleIndex.prototype.query = function(query, limit) {
    var start = new Date();
    limit = limit || 50;
    var q;
    if (Object.prototype.toString.call(query.class) != "[object JavaObject]" || 
            query.class.toString().indexOf("org.apache.lucene.search.") == -1) {
        throw new Error("Query called with none-query object");
    }
    log.debug ("query: " + query.toString());
    return new Result(this.index.searcher.search(query, limit), (new Date()) - start, this.index);
};

/**
 * Create a query from a plain js-object.
 * The conditions-object's properties have to be fields and will be added to the query as SHOULD clauses.
 * If the object contains properties MUST or MUST_NOT, the properties of those objects will also
 * be fields added to the query with their corresponding clauses.
 * The value of those properties may be either a string (used as query string as is) or another object
 * having either the property "value" (again used as query-string as is) or the properties "min" and "max"
 * to form a range query. e.g. to search for documents having the value "test" in their text-field and
 * having a number betweene 1 and 10 in their "id"-field one would pass the following js-object to this function:
 * {text: "test", id: {min: 1, max: 10}}
 * If you don't want nr 5, then use this:
 * {text: "test", id: {min: 1, max: 10}, MUST_NOT: {id: 5}}
 * @param conditions a js-object describing the conditions for this query
 */
SimpleIndex.prototype.createQuery = function(conditions) {
    if (typeof(conditionArr) == "string") {
        // simple query for all fields
        return this.getQueryParser(this.meta.defaultField).parse(conditionArr);
    }
    var bc = [], lucQueries = [], fields = [], AND, OR;
    var si = this;

    var bq = new BooleanQuery();
    var addConditions = function(conArr, clause) {
        for (var field in conArr) {
            if (field == "MUST" || field == "MUST_NOT") {
                continue;
            }
            var condition = conArr[field];
            var luquery = si.getQueryForField(field, condition);
            if (luquery == null)
                continue;
            bq.add(luquery, clause || BooleanClause.Occur.SHOULD);
        }
    }
    addConditions(conditions, BooleanClause.Occur.SHOULD);
    if (!conditions.MUST && !conditions.SHOULD && !conditions.MUST_NOT)
        return bq;
    if (conditions.MUST) {
        addConditions(conditions.MUST, BooleanClause.Occur.MUST);
    }
    if (conditions.MUST_NOT) {
        addConditions(conditions.MUST_NOT, BooleanClause.Occur.MUST_NOT);
    }
    return bq;
};

/**
 * QueryParser cache to avoid unneeded recreation
 */
SimpleIndex.prototype.getQueryParser = function(field) {
    if (!this.qpCache)
        this.qpCache = {};
    if (this.qpCache[field])
        return this.qpCache[field];
    return this.qpCache[field] = new QueryParser(this.index.version, field, this.index.analyzer); 
};

/**
 * Return the correct query-type for the field given depending on the
 * meta-information configured (int, double, string, text...)
 * Possible null if the query may not be created according to the field-type.
 * (e.g. giving the string "abc" as query for a field configured as int-field)
 * @param field the name of the field to create the query for
 * @param query the value to query the given field for
 */
SimpleIndex.prototype.getQueryForField = function(field, query) {
    if (!query) {
        throw new Error("getQueryForField called without query-parameter");
    }

    var meta = this.meta[field] || {type: "text"};
    if (typeof(query) == "string" || typeof(query) == "number")
        query = {value: query};

    switch (meta.type) {
    case "date":
        query.value = convertDate(query.value, meta);
        query.min = convertDate(query.min, meta);
        query.max = convertDate(query.max, meta);
    case "float":
    case "double":
        if (query.value != undefined) {
            return !isNaN(query.value) ? new TermQuery(new Term(field, utils.prepareDoubleValue(query.value))) : null;
        } else if (query.min != undefined && query.max != undefined) {
            return NumericRangeQuery.newDoubleRange(field, query.min, query.max, true, true);
        } else {
            throw new Error("getQueryForField called for double-field has to be either a value-query or a range-query");
        }
    case "int":
        if (query.value != undefined) {
            return !isNaN(query.value) ? new TermQuery(new Term(field, utils.prepareIntValue(query.value))) : null;
        } else if (query.min != undefined && query.max != undefined) {
            return NumericRangeQuery.newIntRange(field, query.min, query.max, true, true);
        } else {
            throw new Error("getQueryForField called for int-field has to be either a value-query or a range-query");
        }
    case "long":
        if (typeof(query.value) == "string") {
            return new TermQuery(new Term(field, utils.prepareLongValue(parseInt(query.value, 10))));
        } else if (typeof(query.value) == "number") {
            return new TermQuery(new Term(field, utils.prepareLongValue(query.value)));
        }
        return null;
    case "string": // Strings aren't tokenized. use it for id's or fixed values
                   // like options from a selectbox
        var pq = new PhraseQuery();
        pq.add(new Term(field, query.value));
        return pq;
    case "text":
    default:
        return new WildcardQuery(new Term(field, query.value));
    }
};

/**
 * Converts the given date to a number and cuts down
 * the resolution if configured.
 * @param d the date to convert
 * @param meta the metainformation of the field this date is used for
 */
var convertDate = function(d, meta) {
    var dat;
    if (typeof(d) == "object") {
        if (!d.getMonths) {
            return null;
        }
        dat = new Date(d.getTime());
    } else if (typeof(d) == "string") {
        if (!isNaN(d)) {
            dat = new Date(parseInt(d, 10));
        } else {
            dat = new Date(d);
            if (d.toString() == "Invalid Date") {
                return null;
            }
        }
    }
    if (!meta || !meta.resolution)
        return dat.getTime();
    // cut down the resolution
    switch(meta.resolution) {
    case "YEAR":
        dat.setMonth(0);
    case "MONTH":
        dat.setDate(1);
    case "DAY":
        dat.setHours(0);
    case "HOUR":
        dat.setMinutes(0);
    case "MINUTE":
        dat.setSeconds(0);
    case "SECOND":
        dat.setMilliseconds(0);
    case "MILLISECOND":
    default:
    }
    return dat;
};

/**
 * @class Result-object holding query-time and the resulting top-documents of a lucene-search
 * @param topdocs the documents retrieved
 * @param querytime the time querying took
 * @param index the index the documents have been retrieved from
 * @constructor
 */
var Result = function(topdocs, querytime, index) {
    this.size = function() {
        return topdocs.totalHits;
    };

    Object.defineProperties(this, {
        querytime: {
            value: querytime,
        },
        index: {
            value: index
        },
        rawTopDocs: {
            value: topdocs,
            readonly: true
            
        }
    })
    
    var extractFieldValue = function (indexableField) {
        var ift = indexableField.fieldType();
        if (!ift.stored()) {
            return;
        }
        var val = indexableField.numericValue();
        if (val == null)
            val = indexableField.stringValue();
        return val;
    };

    /**
     * Returns the nth document of this resultset as
     * plain javascript object.
     * @param idx the index this document has within this resultset
     */
    this.get = function(idx) {
        var doc = index.searcher.doc(topdocs.scoreDocs[idx].doc);
        if (doc == null)
            return null;
        var it = doc.iterator();
        var result = {};
        while (it.hasNext()) {
            var indexableField = it.next();
            var val = extractFieldValue(indexableField);
            if (!val)
                continue;
            result[indexableField.name()] = val;
        }
        return result;
    };

    /**
     * Returns the calculated score of the nth document of this resultset
     */
    this.getScore = function(idx) {
        return topdocs.scoreDocs[idx].score;
    };

    /**
     * Serialize this resultset to an js-object
     */
    this.serialize = function() {
        var result = [];
        for (var i = 0; i < this.size(); i++) {
            result.push({
                data: this.get(i),
                score: this.getScore(i)
            });
        }
        return {
            querytime: this.querytime,
            documents: result
        };
    };
    
    this.toJSON = function() {
        return this.serialize();
    };
};