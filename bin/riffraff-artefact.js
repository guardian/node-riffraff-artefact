'use strict';

var AWS = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var Q = require('q');
var util = require('./lib/util');

var SETTINGS = require('./settings').SETTINGS;

function clean() {
    util.log("Cleaning target ...");
    var target = SETTINGS.leadDir + "/*";

    return Q.promise(function (resolve, reject) {

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

function s3Upload() {
    var s3 = new AWS.S3();
    var file = SETTINGS.leadDir + "/" + SETTINGS.artefactsFilename;

    // build the path
    var rootPath = [SETTINGS.packageName, SETTINGS.buildId].join("/");

    var artefact = Q.promise(function (resolve, reject) {
        var artefactPath = rootPath + "/" + SETTINGS.artefactsFilename;
        util.log("Uploading to " + artefactPath);

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
        util.log("Uploading to " + manifestPath);

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

function compressResource() {
    var sourceDir = SETTINGS.buildDir || ".";
    var targetFolder = SETTINGS.packageDir;
    var targetName = SETTINGS.packageName;

    var zipIt = function zipIt() {
        return util.createZip(sourceDir, targetFolder, targetName);
    };
    var tarIt = function tarIt() {
        return util.createTar(sourceDir, targetFolder, targetName);
    };

    return SETTINGS.isAwsLambda ? zipIt() : tarIt();
}

function packageArtefact() {
    var sourceDir = SETTINGS.leadDir;
    var targetDir = SETTINGS.leadDir;
    var targetName = SETTINGS.artefactsFilename;

    return util.createZip(sourceDir, targetDir, targetName);
}

function createDirectories() {
    util.log("Creating directories ...");

    return Q.all([util.createDir(SETTINGS.targetDir), util.createDir(SETTINGS.leadDir), util.createDir(SETTINGS.leadDir + "/packages"), util.createDir(SETTINGS.packageDir)]);
}

function copyResources() {
    var possibleActions = [[cloudformation, SETTINGS.cloudformation], [deployJson, true]];

    return Q.all(possibleActions.filter(function (a) {
        return a[1];
    }).map(function (a) {
        return a[0]();
    }));
}

function cloudformation() {
    return Q.all([util.createDir(SETTINGS.leadDir + "/packages/cloudformation"), util.copyFile(SETTINGS.rootDir + "/" + SETTINGS.cloudformation, SETTINGS.leadDir + '/packages/cloudformation/')]);
}

function deployJson() {
    return util.copyFile(SETTINGS.rootDir + "/deploy.json", SETTINGS.leadDir);
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
    return clean().then(createDirectories).then(copyResources).then(compressResource).then(packageArtefact);
}

function uploadArtefact() {
    return s3Upload();
}

function determineAction() {
    var buildAndDeployArtefact = function buildAndDeployArtefact() {
        buildArtefact().then(uploadArtefact).catch(function (err) {
            throw err;
        });
    };

    SETTINGS.env !== "dev" ? buildAndDeployArtefact() : buildArtefact();
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