"use strict";

var exec = require("child_process").exec;
var fs = require("fs");
var Q = require("q");
var glob = require("glob");

var SETTINGS = require("../settings").SETTINGS;

var log = process.env.VERBOSE === "true" ? console.log.bind(console) : function () {};

function createDir(dirname) {
    log("Creating directory " + dirname);

    if (!fs.existsSync(dirname)) {
        return Q.promise(function (resolve, reject) {
            fs.mkdir(dirname, function (err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }
}

function copyFile(source, target) {
    log(["Copying", source, "to", target].join(" "));

    return Q.promise(function (resolve) {
        var result = function result(error) {
            if (error) {
                console.error("Failed copying with: " + error.stack);
                process.exit(1);
            }
            return resolve(target);
        };

        var commandString = ["cp", source, target].join(" ");
        log("Running: " + commandString);
        exec(commandString, result);
    });
}

function createZip(sourceDir, targetFolder, targetName) {
    var targetLocation = [targetFolder, "/", targetName.replace(".zip", ""), ".zip"].join("");

    var sourceFiles = "./*";
    process.chdir(sourceDir);

    return Q.promise(function (resolve) {
        var result = function result(error) {
            if (error) {
                console.error("Failed to create zip with: " + error.stack);
                process.exit(1);
            }
            log("Created zip file in: ", targetLocation);

            return resolve(targetLocation);
        };

        var commandString = ["zip -r", targetLocation, sourceFiles].join(" ");
        log("Running: " + commandString);
        exec(commandString, { maxBuffer: SETTINGS.bufferSize }, result);
    });
}

function createTar(sourceDir, targetFolder, targetName) {
    var targetLocation = [targetFolder, "/", targetName.replace(".tgz", ""), ".tgz"].join("");

    return Q.promise(function (resolve) {
        var result = function result(error) {
            if (error) {
                console.error("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            log("Created tgz file in: ", targetLocation);
            return resolve(targetLocation);
        };

        var exclude = "--exclude='" + targetName + ".tgz'";
        var commandString = ["tar czf", targetLocation, exclude, sourceDir].join(" ");
        log("Running: " + commandString);
        exec(commandString, result);
    });
}

function listFiles(sourceDir) {
    return glob.sync("**/*", {
        cwd: sourceDir,
        nosort: true,
        nodir: true
    });
}

module.exports = {
    log: log,
    createDir: createDir,
    createZip: createZip,
    createTar: createTar,
    copyFile: copyFile,
    listFiles: listFiles
};