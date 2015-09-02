const AWS = require('aws-sdk');
const exec = require('child_process').exec;
const fs = require('fs');
const Q = require('q');
const SETTINGS = require('./settings').SETTINGS;

function createDir(dirname) {
    if(!fs.existsSync(dirname)) {
        console.log("Creating directory " + dirname);
        return Q.promise((resolve, reject) => {
            fs.mkdir(dirname, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }
}

function clean() {
    return Q.promise((resolve, reject) => {
        console.log("Cleaning target directory...");
        let result = (error) =>  {
            if (error) {
                console.log("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        const commandString = ["rm -rf", SETTINGS.leadDir + "/*"].join(" ");
        exec(commandString, result);
    });
}

function copyFile(source, target) {
    return Q.promise((resolve, reject) => {
        let result = (error) => {
            if (error) {
                console.log("Failed copying with: " + error.stack);
                process.exit(1);
            }
            return resolve(target);
        };

        const commandString = ["cp", source, target].join(" ");
        exec(commandString, result);
    });
}


function s3Upload() {
    return Q.promise((resolve, reject) => {
        const s3 = new AWS.S3();
        const file = SETTINGS.leadDir + "/" + SETTINGS.artefactsFilename;
        const pieces = file.split('/');
        const filename = pieces[pieces.length-1];

        // build the path
        const path = [SETTINGS.packageName, SETTINGS.buildId, SETTINGS.packageName].join("/");

        console.log("Uploading to " + path);

        fs.readFile(file, (err, data) => {
            const params = {
                Bucket: SETTINGS.artefactBucket,
                Key: path,
                Body: data
            };

            s3.upload(params, (err) => {
                if (err) {
                    reject(err);
                }
                console.log(["Uploaded riffraff artefact to", path, "in",
                             SETTINGS.artefactBucket].join(" "));
            });
        });

        // upload the manifest
        s3.upload({
            Bucket: SETTINGS.manifestBucket,
            Key: path,
            Body: buildManifest()
        }, (err) => {
            if (err) {
                reject(err);
            }
            console.log(["Uploaded riffraff manifest to", path, "in",
                         SETTINGS.manifestBucket].join(" "));
        });

    });
}

function createTar() {
    return Q.promise((resolve, reject) => {
        const target = SETTINGS.packageDir + '/' + SETTINGS.packageName + '.tgz';
        const buildDir = SETTINGS.buildDir || ("*");
        console.log("Creating tgz in " + target);

        let result = (error) => {
            if (error) {
                console.log("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            console.log("Created tgz file in: ", target);
            return resolve("/tmp/" + SETTINGS.packageName + ".tgz");
        };

        const commandString = ["tar czf", "/tmp/" + SETTINGS.packageName + ".tgz" ,
                               buildDir].join(" ");
        exec(commandString, result);

    });
}

function moveTarToTarget(tempLocation) {
    const target = SETTINGS.packageDir + '/' + SETTINGS.packageName + '.tgz';
    return copyFile(tempLocation, target);
}

function createZip() {
    // change directory to the target
    process.chdir(SETTINGS.leadDir);
    return Q.promise((resolve, reject) => {
        const FILENAME = SETTINGS.artefactBucket;

        console.log("Creating zip in ./target/riffraff/" + FILENAME);
        let result = (error) => {
            if (error) {
                console.log("Failed to create zip with: " + error.stack);
                process.exit(1);
            }
            console.log("Created zip file in ./target/riffraff/" + FILENAME);

            return resolve(FILENAME);
        };

        const commandString = ["zip -r", FILENAME, "./*"].join(" ");
        exec(commandString, result);
    });
}



function createDirectories() {
    return Q.all([
        createDir(SETTINGS.targetDir),
        createDir(SETTINGS.leadDir),
        createDir(SETTINGS.leadDir + "/packages"),
        createDir(SETTINGS.leadDir + "/packages/cloudformation"),
        createDir(SETTINGS.packageDir)
    ]);
}

function cloudformation() {
    return copyFile(SETTINGS.rootDir + "/" + SETTINGS.cloudformation,
                    SETTINGS.leadDir + '/packages/cloudformation/');
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
    return clean()
        .then(createDirectories)
        .then(cloudformation)
        .then(deployJson)
        .then(createTar)
        .then((tmp) => { return moveTarToTarget(tmp); })
        .then(createZip);
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

determineAction();
