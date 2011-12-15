var Job = exports.Job = function(type, callback) {

    var createtime = java.lang.System.currentTimeMillis();

    Object.defineProperties(this, {
        "createtime": {
            "value": createtime
        },
        "type": {
            "value": type
        },
        "callback": {
            "value": callback
        }
    });

    return this;
};

/** @ignore */
Job.prototype.toString = function() {
    return "[Job (" + this.type + ")]";
};

/**
 * Constant defining an add job
 * @type Number
 * @final
 */
Job.ADD = "ADD";

/**
 * Constant defining a removal job
 * @type Number
 * @final
 */
Job.REMOVE = "REMOVE";

/**
 * Executes this job
 * @returns True if the job was processed successfully, false otherwise
 * @type Boolean
 */
Job.prototype.execute = function() {
    try {
        this.callback.call(null);
    } catch (e) {
        return false;
    }
    return true;
};
