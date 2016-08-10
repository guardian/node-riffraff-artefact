const exec = require("child_process").exec;
const fs = require("fs");
const Q = require("q");
const glob = require("glob");

const SETTINGS = require("../settings").SETTINGS;

const log = (process.env.VERBOSE === "true") ? console.log.bind(console) : function () {};

function createDir(dirname) {
    log("Creating directory " + dirname);

    if (!fs.existsSync(dirname)) {
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

function copyFile(source, target) {
    log(["Copying", source, "to", target].join(" "));

    return Q.promise((resolve) => {
        let result = (error) => {
            if (error) {
                console.error("Failed copying with: " + error.stack);
                process.exit(1);
            }
            return resolve(target);
        };

        const commandString = ["cp", source, target].join(" ");
        log("Running: " + commandString);
        exec(commandString, result);
    });
}

function createZip(sourceDir, targetFolder, targetName) {
    const targetLocation = [targetFolder, "/", targetName.replace(".zip",""), ".zip"].join("");

    const sourceFiles = "./*";
    process.chdir(sourceDir);

    return Q.promise((resolve) => {
        let result = (error) => {
            if (error) {
                console.error("Failed to create zip with: " + error.stack);
                process.exit(1);
            }
            log("Created zip file in: ", targetLocation);

            return resolve(targetLocation);
        };

        const commandString = ["zip -r", targetLocation, sourceFiles].join(" ");
        log("Running: " + commandString);
        exec(commandString, {maxBuffer: SETTINGS.bufferSize}, result);
    });
}

function createTar(sourceDir, targetFolder, targetName) {
    const targetLocation = [targetFolder, "/", targetName.replace(".tgz",""), ".tgz"].join("");

    return Q.promise((resolve) => {
        let result = (error) => {
            if (error) {
                console.error("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            log("Created tgz file in: ", targetLocation);
            return resolve(targetLocation);
        };

        const exclude = "--exclude='" + targetName + ".tgz'";
        const commandString = ["tar czf", targetLocation, exclude, sourceDir].join(" ");
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
    log,
    createDir,
    createZip,
    createTar,
    copyFile,
    listFiles
};
