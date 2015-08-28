const AWS = require('aws-sdk');
const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

const workingPath = require.main.filename.split("/node_modules")[0];
const ROOT = workingPath;
const LEAD_DIR = ROOT + "/target/riffraff";


/*
 * To be valid packageJson,json must at the very least have
 * a name and a cloudformation field.
 */
console.log("Reading configuration from package.json");
const packageJson = require(ROOT + "/package.json");


const PACKAGE_DIR = LEAD_DIR + "/packages/" + packageJson.name;

function createDir(dirname) {
    if(!fs.existsSync(dirname)) {
        console.log("Creating directory " + dirname);
        fs.mkdirSync(dirname);
    }
}

function clean() {
    return new Promise((resolve, reject) => {
        console.log("Cleaning target directory...");
        let result = (error) =>  {
            if (error) {
                console.log("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        const commandString = ["rm -rf", LEAD_DIR + "/*"].join(" ");
        exec(commandString, result);
    });
}

function copyFile(source, target) {
    return new Promise((resolve, reject) => {
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


function s3Upload(file) {

    const bucket = new AWS.S3({params: {name:
                                      packageJson.bucket}});
    const pieces = file.split('/');
    const filename = pieces[pieces.length-1];

    // build the bucket path
    const path = [packageJson.name, packageJson.version, packageJson.name, filename].join("/");

    console.log("Uploading " + path);

    fs.readFile(file, function (err, data) {
        const params = {
            Bucket: packageJson.bucket,
            Key: path,
            Body: data
        };

        bucket.upload(params, function (err) {
            if (err) {
                console.log("Failed with error:", err);
                process.exit(1);
            }
            console.log("Uploaded file to " + path);
        });
    });
}

function createTar() {
    return new Promise((resolve, reject) => {
        const target = PACKAGE_DIR + '/' + packageJson.name + '.tgz';
        const buildDir = packageJson.buildDir || (ROOT + "/*");
        console.log("Creating tgz in " + target);

        let result = (error) => {
            if (error) {
                console.log("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            console.log("Created tgz file in: ", target);
            return resolve();
        };

        const commandString = ["tar czf", target, buildDir].join(" ");
        exec(commandString, result);

    });
}

function createZip() {
    // change directory to the target
    process.chdir(LEAD_DIR);
    return new Promise((resolve, reject) => {
        const FILENAME = "artifacts.zip";

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
    return new Promise((resolve, reject) => {
        createDir(LEAD_DIR);
        createDir(LEAD_DIR + "/packages");
        createDir(LEAD_DIR + "/packages/cloudformation");
        createDir(PACKAGE_DIR);
        return resolve();
    });
}

function cloudformation() {
    return copyFile(ROOT + "/" + packageJson.cloudformation,
                    LEAD_DIR + '/packages/cloudformation/');
}

function deployJson() {
    return copyFile(ROOT + "/deploy.json", LEAD_DIR);
}

function buildManifest() {
    return {
        projectName: packageJson.name
    };
}

// run the processes
clean()
    .then(createDirectories)
    .then(cloudformation)
    .then(deployJson)
    .then(createTar)
    .then(createZip);
