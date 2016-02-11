const AWS = require('aws-sdk');
const exec = require('child_process').exec;
const fs = require('fs');
const Q = require('q');
const util = require('./lib/util')

const SETTINGS = require('./settings').SETTINGS;

function clean() {
    util.log("Cleaning target ...")
    const target = SETTINGS.leadDir + "/*";

    return Q.promise((resolve, reject) => {

        let result = (error) =>  {
            if (error) {
                console.error("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        const commandString = ["rm -rf", SETTINGS.leadDir + "/*"].join(" ");
        util.log("Running: " + commandString);
        exec(commandString, result);
    });
}


function s3Upload() {
    const s3 = new AWS.S3();
    const file = SETTINGS.leadDir + "/" + SETTINGS.artefactsFilename;

    // build the path
    const rootPath = [SETTINGS.packageName, SETTINGS.buildId].join("/");

    var artefact = Q.promise((resolve, reject) => {
        const artefactPath = rootPath + "/" + SETTINGS.artefactsFilename;
        util.log("Uploading to " + artefactPath);

        const stream = fs.createReadStream(file);
        const params = {
            Bucket: SETTINGS.artefactBucket,
            Key: artefactPath,
            Body: stream,
            ACL: "bucket-owner-full-control"
        };
        s3.upload(params, (err) => {
            if (err) {
                throw new Error(err);
            }
            console.log(["Uploaded riffraff artefact to", artefactPath, "in",
                         SETTINGS.artefactBucket].join(" "));
            resolve();
        });
    });

    // upload the manifest
    var manifest = Q.promise((resolve, reject) => {
        const manifestPath = rootPath + "/" + SETTINGS.manifestFile;
        util.log("Uploading to " + manifestPath);

        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: manifestPath,
            Body: JSON.stringify(buildManifest()),
            ACL: "bucket-owner-full-control"
        }, (err) => {
            if (err) {
                throw err;
            }
            console.log(["Uploaded riffraff manifest to", manifestPath, "in",
                         SETTINGS.manifestBucket].join(" "));
            resolve();
        });
    });

    return Q.all([manifest, artefact]);
}

function compressResource() {
    const sourceDir    = SETTINGS.buildDir || ".";
    const targetFolder = SETTINGS.packageDir;
    const targetName   = SETTINGS.packageName; 

    const zipIt = () => util.createZip(sourceDir, targetFolder, targetName);
    const tarIt = () => util.createTar(sourceDir, targetFolder, targetName);

    return SETTINGS.isAwsLambda ? zipIt() : tarIt() 
}

function packageArtefact() {
    const sourceDir = SETTINGS.leadDir;
    const targetDir = SETTINGS.leadDir;
    const targetName = SETTINGS.artefactsFilename;

    return util.createZip(sourceDir, targetDir, targetName); 
}

function createDirectories() {
    util.log("Creating directories ...")

    return Q.all([
        util.createDir(SETTINGS.targetDir),
        util.createDir(SETTINGS.leadDir),
        util.createDir(SETTINGS.leadDir + "/packages"),
        util.createDir(SETTINGS.leadDir + "/packages/cloudformation"),
        util.createDir(SETTINGS.packageDir)
    ]);
}

function cloudformation() {
    return util.copyFile(SETTINGS.rootDir + "/" + SETTINGS.cloudformation,
                    SETTINGS.leadDir + '/packages/cloudformation/');
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
    return clean()
        .then(createDirectories)
        .then(cloudformation)
        .then(deployJson)
        .then(compressResource)
        .then(packageArtefact);
}

function uploadArtefact() {
    return s3Upload();
}

function determineAction() {
    if (SETTINGS.env !== "dev") {
        buildArtefact()
            .then(uploadArtefact)
            .catch((err) => {
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
}

if (require.main === module) {
    determineAction();
}
