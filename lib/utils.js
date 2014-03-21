var {Version} = org.apache.lucene.util;

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