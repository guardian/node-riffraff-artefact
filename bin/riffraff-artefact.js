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
    var rootPath = [SETTINGS.packageName, SETTINGS.buildId].join("/");

    var artefact = Q.promise(function (resolve, reject) {
        var artefactPath = rootPath + "/" + SETTINGS.artefactsFilename;
        console.log("Uploading to " + artefactPath);

        var stream = fs.createReadStream(file);
        var params = {
            Bucket: SETTINGS.artefactBucket,
            Key: artefactPath,
            Body: stream,
            ACL: "bucket-owner-full-control"
        };
        s3.upload(params, function (err) {
            if (err) {
                throw new Error(err);
            }
            console.log(["Uploaded riffraff artefact to", artefactPath, "in", SETTINGS.artefactBucket].join(" "));
            resolve();
        });
    });

    // upload the manifest
    var manifest = Q.promise(function (resolve, reject) {
        var manifestPath = rootPath + "/" + SETTINGS.manifestFile;
        console.log("Uploading to " + manifestPath);

        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: manifestPath,
            Body: JSON.stringify(buildManifest()),
            ACL: "bucket-owner-full-control"
        }, function (err) {
            if (err) {
                throw err;
            }
            console.log(["Uploaded riffraff manifest to", manifestPath, "in", SETTINGS.manifestBucket].join(" "));
            resolve();
        });
    });

    return Q.all([manifest, artefact]);
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

module.exports = {
    determineAction: determineAction,
    settings: SETTINGS,
    buildManifest: buildManifest,
    s3Upload: s3Upload
};

if (require.main === module) {
    determineAction();
}

//# sourceMappingURL=riffraff-artefact.js.map