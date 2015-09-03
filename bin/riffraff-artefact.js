'use strict';

var AWS = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var Q = require('q');
var SETTINGS = require('./settings').SETTINGS;

function createDir(dirname) {
    if (!fs.existsSync(dirname)) {
        console.log("Creating directory " + dirname);
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

function clean() {
    return Q.promise(function (resolve, reject) {
        console.log("Cleaning target directory...");
        var result = function result(error) {
            if (error) {
                console.log("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        var commandString = ["rm -rf", SETTINGS.leadDir + "/*"].join(" ");
        exec(commandString, result);
    });
}

function copyFile(source, target) {
    return Q.promise(function (resolve, reject) {
        var result = function result(error) {
            if (error) {
                console.log("Failed copying with: " + error.stack);
                process.exit(1);
            }
            return resolve(target);
        };

        var commandString = ["cp", source, target].join(" ");
        exec(commandString, result);
    });
}

function s3Upload() {
    var s3 = new AWS.S3();
    var file = SETTINGS.leadDir + "/" + SETTINGS.artefactsFilename;

    // build the path
    var path = [SETTINGS.packageName, SETTINGS.buildId, SETTINGS.packageName].join("/");

    console.log("Uploading to " + path);

    var manifest = Q.promise(function (resolve, reject) {
        fs.readFile(file, function (err, data) {
            var params = {
                Bucket: SETTINGS.artefactBucket,
                Key: path,
                Body: data
            };

            s3.upload(params, function (err) {
                if (err) {
                    reject(err);
                }
                console.log(["Uploaded riffraff artefact to", path, "in", SETTINGS.artefactBucket].join(" "));
                resolve();
            });
        });
    });

    // upload the manifest
    var artifact = Q.promise(function (resolve, reject) {
        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: path,
            Body: buildManifest()
        }, function (err) {
            if (err) {
                reject(err);
            }
            console.log(["Uploaded riffraff manifest to", path, "in", SETTINGS.manifestBucket].join(" "));
            resolve();
        });
    });

    return Q.all([manifest, artifact]);
}

function createTar() {
    return Q.promise(function (resolve, reject) {
        var target = SETTINGS.packageDir + '/' + SETTINGS.packageName + '.tgz';
        var buildDir = SETTINGS.buildDir || "*";
        console.log("Creating tgz in " + target);

        var result = function result(error) {
            if (error) {
                console.log("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            console.log("Created tgz file in: ", target);
            return resolve("/tmp/" + SETTINGS.packageName + ".tgz");
        };

        var commandString = ["tar czf", "/tmp/" + SETTINGS.packageName + ".tgz", buildDir].join(" ");
        exec(commandString, result);
    });
}

function moveTarToTarget(tempLocation) {
    var target = SETTINGS.packageDir + '/' + SETTINGS.packageName + '.tgz';
    return copyFile(tempLocation, target);
}

function createZip() {
    // change directory to the target
    process.chdir(SETTINGS.leadDir);
    return Q.promise(function (resolve, reject) {
        var FILENAME = SETTINGS.artefactsFilename;

        console.log("Creating zip in ./target/riffraff/" + FILENAME);
        var result = function result(error) {
            if (error) {
                console.log("Failed to create zip with: " + error.stack);
                process.exit(1);
            }
            console.log("Created zip file in ./target/riffraff/" + FILENAME);

            return resolve(FILENAME);
        };

        var commandString = ["zip -r", FILENAME, "./*"].join(" ");
        exec(commandString, result);
    });
}

function createDirectories() {
    return Q.all([createDir(SETTINGS.targetDir), createDir(SETTINGS.leadDir), createDir(SETTINGS.leadDir + "/packages"), createDir(SETTINGS.leadDir + "/packages/cloudformation"), createDir(SETTINGS.packageDir)]);
}

function cloudformation() {
    return copyFile(SETTINGS.rootDir + "/" + SETTINGS.cloudformation, SETTINGS.leadDir + '/packages/cloudformation/');
}

function deployJson() {
    return copyFile(SETTINGS.rootDir + "/deploy.json", SETTINGS.leadDir);
}

function buildManifest() {
    return {
        branch: SETTINGS.projectBranchName,
        vcsURL: SETTINGS.vcsURL,
        revision: SETTINGS.vcsRevision,
        startTime: SETTINGS.buildStartTime,
        buildNumber: SETTINGS.buildId,
        projectName: SETTINGS.packageName
    };
}

function buildArtefact() {
    return clean().then(createDirectories).then(cloudformation).then(deployJson).then(createTar).then(function (tmp) {
        return moveTarToTarget(tmp);
    }).then(createZip);
}

function uploadArtefact() {
    return s3Upload();
}

function determineAction() {
    if (SETTINGS.env !== "dev") {
        buildArtefact().then(uploadArtefact)['catch'](function (err) {
            throw err;
        });
    } else {
        buildArtefact();
    }
}

determineAction();

//# sourceMappingURL=riffraff-artefact.js.map