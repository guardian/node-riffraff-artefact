const fs = require('fs');
const Q = require('q');


function createDir(dirname) {
    if(!fs.existsSync(dirname)) {
        log("Creating directory " + dirname);
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
    return Q.promise((resolve, reject) => {
        let result = (error) => {
            if (error) {
                console.error("Failed copying with: " + error.stack);
                process.exit(1);
            }
            return resolve(target);
        };

        const commandString = ["cp", source, target].join(" ");
        exec(commandString, result);
    });
}

function createZip(sourceDir, targetFolder, targetName) {
    const targetLocation = targetFolder + targetName + ".zip";
    const sourceFiles = sourceDir + "/*";

    return Q.promise((resolve, reject) => {
        let result = (error) => {
            if (error) {
                console.error("Failed to create zip with: " + error.stack);
                process.exit(1);
            }
            log("Created zip file.");

            return resolve(FILENAME);
        };

        const commandString = ["zip -r", targetLocation, sourceFiles].join(" ");
        exec(commandString, result);
    });
}

function createTar(sourceDir, targetFolder, targetName) {
    const targetLocation = targetFolder + targetName + ".tgz";

    return Q.promise((resolve, reject) => {
        let result = (error) => {
            if (error) {
                console.error("Failed to create tar with: " + error.stack);
                process.exit(1);
            }
            log("Created tgz file in: ", targetLocation);
            return resolve(targetLocation);
        };

        const commandString = ["tar czf", targetLocation, sourceDir].join(" ");
        exec(commandString, result);
    });
}

module.exports = {
    createDir,
    createZip,
    createTar,
    copyFile
}
