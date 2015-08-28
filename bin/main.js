'use strict';

var AWS = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

// cwd is used here since we assumed this command will be executed
// in the package root. Otherwise it ain't going to work
var ROOT = process.cwd();
var LEAD_DIR = ROOT + "/target/riffraff";

/*
 * To be valid packageJson,json must at the very least have
 * a name and a cloudformation field.
 */
console.log("Reading configuration from package.json");
var packageJson = require(ROOT + "/package.json");

var PACKAGE_DIR = LEAD_DIR + "/packages/" + packageJson.name;

function createDir(dirname) {
    if (!fs.existsSync(dirname)) {
        console.log("Creating directory " + dirname);
        fs.mkdirSync(dirname);
    }
}

function clean() {
    return new Promise(function (resolve, reject) {
        console.log("Cleaning target directory...");
        var result = function result(error) {
            if (error) {
                console.log("Failed deleting with: " + error.stack);
                process.exit(1);
            }
            return resolve();
        };

        var commandString = ["rm -rf", LEAD_DIR + "/*"].join(" ");
        exec(commandString, result);
    });
}

function copyFile(source, target) {
    return new Promise(function (resolve, reject) {
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

function s3Upload(file) {

    var bucket = new AWS.S3({ params: { name: packageJson.bucket } });
    var pieces = file.split('/');
    var filename = pieces[pieces.length - 1];

    // build the bucket path
    var path = [packageJson.name, packageJson.version, packageJson.name, filename].join("/");

    console.log("Uploading " + path);

    fs.readFile(file, function (err, data) {
        var params = {
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
    return new Promise(function (resolve, reject) {
        var target = PACKAGE_DIR + '/' + packageJson.name + '.tgz';
        var buildDir = packageJson.buildDir || ROOT + "/*";
        console.log("Creating tgz in " + target);

        var result = function result(error) {
            if (error) {
                console.log("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            console.log("Created tgz file in: ", target);
            return resolve();
        };

        var commandString = ["tar czf", target, buildDir].join(" ");
        exec(commandString, result);
    });
}

function createZip() {
    // change directory to the target
    process.chdir(LEAD_DIR);
    return new Promise(function (resolve, reject) {
        var FILENAME = "artifacts.zip";

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
    return new Promise(function (resolve, reject) {
        createDir(LEAD_DIR);
        createDir(LEAD_DIR + "/packages");
        createDir(LEAD_DIR + "/packages/cloudformation");
        createDir(PACKAGE_DIR);
        return resolve();
    });
}

function cloudformation() {
    return copyFile(ROOT + "/" + packageJson.cloudformation, LEAD_DIR + '/packages/cloudformation/');
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
clean().then(createDirectories).then(cloudformation).then(deployJson).then(createTar).then(createZip);

//# sourceMappingURL=main.js.map