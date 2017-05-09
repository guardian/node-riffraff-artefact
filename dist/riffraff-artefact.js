"use strict";

var AWS = require("aws-sdk");
var exec = require("child_process").exec;
var fs = require("fs");
var Q = require("q");
var path = require("path");
var util = require("./lib/util");

var SETTINGS = require("./settings").SETTINGS;

function clean() {
    util.log("Cleaning target ...");

    return Q.promise(function (resolve) {

        var result = function result(error) {
            if (error) {
                console.error("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        var commandString = ["rm -rf", SETTINGS.leadDir + "/*"].join(" ");
        util.log("Running: " + commandString);
        exec(commandString, result);
    });
}

function s3FilesUpload() {
    return uploadIndividualFiles().then(uploadManifest);
}

function uploadIndividualFiles() {
    var rootPath = [SETTINGS.manifestProjectName, SETTINGS.buildId].join("/");

    return util.listFiles(SETTINGS.leadDir).reduce(function (promise, filename) {
        return promise.then(function () {
            return upload(SETTINGS.artefactBucket, rootPath + "/" + filename, fs.createReadStream(path.join(SETTINGS.leadDir, filename)));
        });
    }, Q.resolve()).then(function () {
        util.log("Uploaded riffraff packages to " + rootPath + " in " + SETTINGS.artefactBucket);
    });
}

function uploadManifest() {
    var rootPath = [SETTINGS.manifestProjectName, SETTINGS.buildId].join("/");
    var manifestPath = rootPath + "/" + SETTINGS.manifestFile;

    return upload(SETTINGS.manifestBucket, manifestPath, JSON.stringify(buildManifest())).then(function () {
        util.log("Uploaded riffraff manifest to " + manifestPath + " in " + SETTINGS.manifestBucket);
    });
}

function upload(bucket, key, body) {
    var s3 = new AWS.S3();
    return Q.promise(function (resolve, reject) {
        util.log("Uploading to " + key);
        s3.upload({
            Bucket: bucket,
            Key: key,
            Body: body,
            ACL: "bucket-owner-full-control"
        }, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function compressResource() {
    var sourceDir = SETTINGS.buildDir || ".";
    var targetFolder = SETTINGS.packageDir;
    var targetName = SETTINGS.packageName;

    return util.createZip(sourceDir, targetFolder, targetName);
}

function createDirectories() {
    util.log("Creating directories ...");
    return Q.all([util.createDir(SETTINGS.targetDir), util.createDir(SETTINGS.leadDir), util.createDir(SETTINGS.packageDir)]);
}

function copyResources() {
    var possibleActions = [[cloudformation, SETTINGS.cloudformation], [riffraffFile, true]];

    return Q.all(possibleActions.filter(function (a) {
        return a[1];
    }).map(function (a) {
        return a[0]();
    }));
}

function cloudformation() {
    return Q.all([util.createDir(SETTINGS.leadDir + "/packages/cloudformation"), util.copyFile(SETTINGS.rootDir + "/" + SETTINGS.cloudformation, SETTINGS.leadDir + "/packages/cloudformation/")]);
}

function riffraffFile() {
    return util.copyFile(SETTINGS.rootDir + "/" + SETTINGS.riffraffFile, SETTINGS.leadDir);
}

function buildManifest() {
    return {
        branch: SETTINGS.projectBranchName,
        vcsURL: SETTINGS.vcsURL,
        revision: SETTINGS.vcsRevision,
        startTime: SETTINGS.buildStartTime,
        buildNumber: SETTINGS.buildId,
        projectName: SETTINGS.manifestProjectName || SETTINGS.packageName
    };
}

function buildArtefact() {
    return clean().then(createDirectories).then(copyResources).then(compressResource);
}

function uploadArtefact() {
    return s3FilesUpload();
}

function determineAction() {
    var buildAndDeployArtefact = function buildAndDeployArtefact() {
        buildArtefact().then(uploadArtefact).catch(function (err) {
            throw err;
        });
    };

    SETTINGS.env !== "dev" && SETTINGS.uploadArtefact ? buildAndDeployArtefact() : buildArtefact();
}

module.exports = {
    determineAction: determineAction,
    settings: SETTINGS,
    buildManifest: buildManifest,
    s3FilesUpload: s3FilesUpload
};

if (require.main === module) {
    determineAction();
}