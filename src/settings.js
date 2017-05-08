const path = require("path");

const workingPath = path.dirname(require.main.filename);
const ROOT = process.env.ARTEFACT_PATH || workingPath;
const ENVIRONMENT = determineEnvironment();

const log = (process.env.VERBOSE === "true") ? console.log.bind(console) : function () {};


log("Determined running in: " + ENVIRONMENT);
log("Root project path set as " + ROOT);

/*
 * To be valid packageJson,json must at the very least have
 * a name and a cloudformation field.
 */
log("Reading configuration from " + ROOT + "/package.json");

const packageJson = require(ROOT + "/package.json");
const cf = packageJson.cloudformation;
const projectName = packageJson.projectName;
const riffraffFile = packageJson.riffraffFile || "/riff-raff.yaml";

const uploadArtefact = packageJson.uploadArtefact === undefined ? true : packageJson.uploadArtefact;

let SETTINGS = {
    rootDir: ROOT,
    packageName: packageJson.name,
    manifestProjectName: projectName || packageJson.name,
    cloudformation: (cf == undefined) ? "cloudformation.json" : cf,
    buildStartTime: getDate(),
    projectBranchName: getBranchName() || "Unknown",
    manifestFile: "build.json",
    vcsURL: packageJson.repository || "Unknown",
    vcsRevision: getVcsRevision() || "Unknown",
    buildId:  getBuildId() || "DEV",
    artefactBucket: "riffraff-artifact",
    manifestBucket: "riffraff-builds",
    targetDir: ROOT + "/target",
    leadDir: ROOT + "/target/riffraff",
    packageDir: ROOT + "/target/riffraff/" + packageJson.name,
    buildDir: packageJson.buildDir || undefined,
    bufferSize: parseInt(process.env.NODE_STDOUT_BUFFER || (1024 * 5000)),
    env: ENVIRONMENT,
    riffraffFile: riffraffFile,
    uploadArtefact: uploadArtefact
};


function getDate() {
    var date = new Date();
    return date.toISOString();
}

function determineEnvironment() {
    if (process.env.CIRCLECI && process.env.CI) {
        return "circle-ci";
    } else if (process.env.TRAVIS && process.env.CI) {
        return "travis-ci";
    } else if (process.env.JENKINS_URL) {
        return "jenkins";
    } else if (process.env.TEAMCITY_VERSION) {
        return "teamcity";
    } else {
        return "dev";
    }
}

function getBranchName() {
    switch (ENVIRONMENT) {
        case "circle-ci":
        return process.env.CIRCLE_BRANCH;

        case "travis-ci":
        return process.env.TRAVIS_PULL_REQUEST === "false" ? process.env.TRAVIS_BRANCH : process.env.TRAVIS_PULL_REQUEST;

        case "jenkins":
        return process.env.GIT_BRANCH;

        case "teamcity":
        return process.env.TEAMCITY_BRANCH.split("/").slice(-1)[0];

        default:
        return "dev";
    }
}

function getVcsRevision() {
    switch (ENVIRONMENT) {
        case "circle-ci":
        return process.env.CIRCLE_SHA1;

        case "travis-ci":
        return process.env.TRAVIS_COMMIT;

        case "jenkins":
        return process.env.GIT_COMMIT;

        case "teamcity":
        return process.env.BUILD_VCS_NUMBER;

        default:
        return "dev";
    }
}

function getBuildId() {
    switch (ENVIRONMENT) {
        case "circle-ci":
        return process.env.CIRCLE_BUILD_NUM;

        case "travis-ci":
        return process.env.TRAVIS_BUILD_NUMBER;

        case "jenkins":
        return process.env.BUILD_NUMBER;

        case "teamcity":
        return process.env.BUILD_NUMBER;

        default:
        return "dev";
    }
}

// build tool specific settings - currently only works for CIRCL_CI
log(SETTINGS);
exports.SETTINGS = SETTINGS;
