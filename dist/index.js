"use strict";
var ngo_1 = require("./ngo");
var class_fold_1 = require("./class-fold");
var prefix_functions_1 = require("./prefix-functions");
var tmp = require('tmp');
var fs = require('fs');
var HAS_DECORATORS = /decorators/;
var HAS_CTOR_PARAMETERS = /ctorParameters/;
module.exports = function (content) {
    if (HAS_DECORATORS.test(content) || HAS_CTOR_PARAMETERS.test(content)) {
        var tmpFile = tmp.fileSync({ postfix: '.js' }).name;
        console.log('temp file', this.request, tmpFile);
        fs.writeFileSync(tmpFile, content);
        fs.writeFileSync(tmpFile, ngo_1.scrubFile(tmpFile, this.request));
        fs.writeFileSync(tmpFile, class_fold_1.foldFile(tmpFile, this.request));
        return prefix_functions_1.prefixFunctions(tmpFile, this.request);
    }
    return content;
};
