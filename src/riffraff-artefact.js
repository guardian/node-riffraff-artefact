const AWS = require("aws-sdk");
const exec = require("child_process").exec;
const fs = require("fs");
const Q = require("q");
const path = require("path");
const util = require("./lib/util");
const yaml = require("js-yaml");

const SETTINGS = require("./settings").SETTINGS;

function clean() {
    util.log("Cleaning target ...");

    return Q.promise((resolve) => {

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


function s3FilesUpload() {
    return uploadIndividualFiles().then(uploadManifest);
}

function uploadIndividualFiles () {
    const rootPath = [SETTINGS.manifestProjectName, SETTINGS.buildId].join("/");

    return util.listFiles(SETTINGS.leadDir).reduce((promise, filename) => {
        return promise.then(() => upload(
            SETTINGS.artefactBucket,
            rootPath + "/" + filename,
            fs.createReadStream(path.join(SETTINGS.leadDir, filename))
        ));
    }, Q.resolve()).then(() => {
        util.log(`Uploaded riffraff packages to ${rootPath} in ${SETTINGS.artefactBucket}`);
    });
}

function uploadManifest () {
    const rootPath = [SETTINGS.manifestProjectName, SETTINGS.buildId].join("/");
    const manifestPath = rootPath + "/" + SETTINGS.manifestFile;

    return upload(
        SETTINGS.manifestBucket,
        manifestPath,
        JSON.stringify(buildManifest())
    ).then(() => {
        util.log(`Uploaded riffraff manifest to ${manifestPath} in ${SETTINGS.manifestBucket}`);
    });
}

function upload (bucket, key, body) {
    const s3 = new AWS.S3();
    return Q.promise((resolve, reject) => {
        util.log("Uploading to " + key);
        s3.upload({
            Bucket: bucket,
            Key: key,
            Body: body,
            ACL: "bucket-owner-full-control"
        }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function compressResource() {
    const sourceDir    = SETTINGS.buildDir || ".";
    const targetFolder = SETTINGS.packageDir;
    const targetName   = SETTINGS.packageName;

    const zipIt = () => util.createZip(sourceDir, targetFolder, targetName);
    const tarIt = () => util.createTar(sourceDir, targetFolder, targetName);

    return SETTINGS.isAwsLambda ? zipIt() : tarIt();
}


function createDirectories() {
    util.log("Creating directories ...");
    return Q.all([
        util.createDir(SETTINGS.targetDir),
        util.createDir(SETTINGS.leadDir),
        util.createDir(SETTINGS.packageDir)
    ]);
}

function copyResources() {
    const possibleActions = [
        [cloudformation, SETTINGS.cloudformation],
        [riffraffFile, true]
    ];

    return Q.all(possibleActions
        .filter((a) => a[1])
        .map((a) => a[0]()));
}

function cloudformation() {
    return Q.all([
        util.createDir(SETTINGS.leadDir + "/" + SETTINGS.cloudformationAppName),
        util.createDir(SETTINGS.leadDir + "/" + SETTINGS.cloudformationAppName + "/cloudformation"),
        util.copyFile(
            SETTINGS.rootDir + "/" + SETTINGS.cloudformation,
            SETTINGS.leadDir + "/" + SETTINGS.cloudformationAppName + "/cloudformation"
        )
    ]);
}

function riffraffFile() {
    return util.copyFile(
        SETTINGS.rootDir + "/" + SETTINGS.riffraffFile,
        SETTINGS.leadDir
    );
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
    return clean()
        .then(createDirectories)
        .then(copyResources)
        .then(compressResource);
}

function uploadArtefact() {
    return s3FilesUpload();
}

function determineAction() {
    if (!validateYaml()){
        return;
    }

    const buildAndDeployArtefact = () => {
        buildArtefact()
            .then(uploadArtefact)
            .catch((err) => { throw err; });
    };

    (SETTINGS.env !== "dev" && SETTINGS.uploadArtefact) ? buildAndDeployArtefact() : buildArtefact();
}

function validateYaml(){
    const file = SETTINGS.riffraffFile;
    try {
        yaml.load(fs.readFileSync(file,"utf8"));
        util.log(file + " successfully parsed");
        return true;
    } catch (e) {
        console.error(e,file + " was not successfully parsed.");
    }
    return false;
}

module.exports = {
    determineAction: determineAction,
    settings: SETTINGS,
    buildManifest: buildManifest,
    s3FilesUpload: s3FilesUpload,
    validateYaml: validateYaml
};

if (require.main === module) {
    determineAction();
}
