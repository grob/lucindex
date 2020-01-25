// add all jar files in jars directory to classpath
getRepository(module.resolve("../jars/"))
        .getResources()
        .filter(function(r) {
            return r.name.endsWith(".jar");
        }).forEach(function(file) {
            if (!addToClasspath(file)) {
                throw new Error("Unable to add " + file + " to classpath");
            }
        });

exports.Index = require("./index");
