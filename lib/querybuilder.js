var {BooleanQuery, BooleanClause} = org.apache.lucene.search;

/**
 * A helper building queries for lucene using simpleindex fields to convert
 * the query-strings into lucene queries.
 * 
 * QueryBuilder tries to preserve the original query if only one condition
 * is specified. It will automatically switch to BooleanQuery if more than
 * one condition is specified or QueryBuilder.must or QueryBuilder.not have
 * been used to specify a condition
 */
var QueryBuilder = exports.QueryBuilder = function(si) {
    if (!si) {
        throw new Error("QueryBuilder may only be created with a SimpleIndex-instance");
    }
    Object.defineProperties(this, {
        si: {
            value: si
        }
    });
};

/**
 * Checks if the given object is a instance of a class of the java-package
 * org.apache.lucene.search
 */
var isLuceneSearchClass = function(obj) {
    if (obj === null || obj === undefined) {
        return false;
    }
    if (!obj.class || obj.class.toString().indexOf("class org.apache.lucene.search") < 0) {
        return false;
    }
    return true;
}

/**
 * Add the given query to the conditions using the given occurence-clause
 */
QueryBuilder.prototype.addCondition = function(query, clause) {
    if (!isLuceneSearchClass(query)) {
        throw new Error("QueryBuilder.addCondition demands a lucene query as first parameter");
    }
    if (clause === null || clause === undefined) {
        clause = BooleanClause.SHOULD;
    } else if (!(clause instanceof BooleanClause.Occur)) {
        throw new Error("QueryBuilder.addCondition demands a instance of BooleanClause.Occur");
    }
    if (this.query == undefined && clause === BooleanClause.Occur.SHOULD) {
        this.query = query;
        return;
    } else if (this.query == undefined) {
        this.query = new BooleanQuery();
    } else if (!(this.query instanceof BooleanQuery)) {
        var q = this.query;
        this.query = new BooleanQuery();
        this.addCondition(q, BooleanClause.Occur.SHOULD);
    }
    this.query.add(query, clause);
};

/**
 * Convert the given strg into lucene query(s) using the given field
 * and call this.addCondition with the query created by the given field.
 * 
 * The second argument may also be an array. All elements will be
 * added as seperate conditions then. 
 */
QueryBuilder.prototype.convertAndAdd = function(field, strg, clause) {
    if (strg === null || strg === undefined) {
        throw new Error("A query-string has to be specified");
    }
    if (Array.isArray(strg)) {
        for each (var part in strg) {
            this.convertAndAdd(field, part, clause);
        }
        return;
    }
    var q = field.getQueryFor(strg);
    if (q === null || q === undefined) {
        return;
    }
    this.addCondition(q, clause);
};

/**
 * Add a condition that SHOULD be satisfied
 */
QueryBuilder.prototype.should = function(name, strg) {
    this.convertAndAdd(this.si.getField(name), strg, BooleanClause.Occur.SHOULD);
    return this;
};

/**
 * Add a condition that MUST be satisfied
 */
QueryBuilder.prototype.must = function(name, strg) {
    this.convertAndAdd(this.si.getField(name), strg, BooleanClause.Occur.MUST);
    return this;
};

/**
 * Add a condition that MUST_NOT be satisfied
 */
QueryBuilder.prototype.not = function(name, strg) {
    this.convertAndAdd(this.si.getField(name), strg, BooleanClause.Occur.MUST_NOT);
    return this;
};

/**
 * Returns the constructed query
 */
QueryBuilder.prototype.getQuery = function() {
    return this.query;
};

/**
 * Resets the QueryBuilder
 */
QueryBuilder.prototype.reset = function() {
    this.query = undefined;
};