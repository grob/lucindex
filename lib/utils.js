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