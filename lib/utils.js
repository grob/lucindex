var {Version} = org.apache.lucene.util;
var {NumericUtils, BytesRef} = org.apache.lucene.util;

/**
 * Resolves a string to a lucene-Version-object or if it
 * already is a Version-object just returns it.
 */
exports.resolveVersion = function(stringOrVersion) {
    if (!stringOrVersion) {
        return Version.LUCENE_47;
    }
    if (stringOrVersion.class && 
            stringOrVersion.class.toString() == "class org.apache.lucene.util.Version") {
        return stringOrVersion;
    }
    return Version[stringOrVersion];
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
exports.prepareFloatValue = function(val) {
    return prepareDoubleValue(val);
    // FIXME: is there a possibility to avoid the rhino-bug where java-float-primitives are buggy (e.g. 5.3 -> 5.30000019###)
    // return this.prepareIntValue(NumericUtils.floatToSortableInt(val));
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
exports.prepareIntValue = function(val) {
    var bytes = new BytesRef(NumericUtils.BUF_SIZE_INT);
    NumericUtils.intToPrefixCoded(val, 0, bytes);
    return bytes;
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
var prepareDoubleValue = exports.prepareDoubleValue = function(val) {
    return prepareLongValue(NumericUtils.doubleToSortableLong(val));
};

/**
 * Returns the value encoded as ByteRef representing
 * a lucene understandable float-value
 * @params val the value to convert
 * @returns ByteRef value to use in Term or for update/remove
 */
var prepareLongValue = exports.prepareLongValue = function(val) {
    var bytes = new BytesRef(NumericUtils.BUF_SIZE_LONG);
    NumericUtils.longToPrefixCoded(val, 0, bytes);
    return bytes;
};

/**
 * Tryes to convert the given value into a date and cuts down
 * the resolution if one is given.
 * @param d tha date to convert
 * @param resolution the resolution the date should have
 */
exports.convertToDate = function(d, resolution) {
    var dat;
    if (typeof(d) == "object") {
        if (!d.getMonth || d.toString() == "Invalid Date") {
            return null;
        }
        dat = new Date(d.getTime());
    } else if (typeof(d) == "string") {
        if (!isNaN(d)) {
            dat = new Date(parseInt(d, 10));
        } else {
            dat = new Date(d);
        }
    }
    if (dat.toString() == "Invalid Date") {
        return null;
    }
    if (!resolution)
        return dat.getTime();
    // cut down the resolution
    switch(resolution) {
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
 * Takes the value and converts it to a string if
 * possible. Returns null if not.
 */
exports.ensureString = function(val) {
    if (val === null || val === undefined)
        return null;
    switch(typeof(val)) {
    case "number":
        return "" + val;
    case "object":
        return val.toString();
    case "bool":
        return val ? "true" : "false";
    default:
        return val;
    }
};
