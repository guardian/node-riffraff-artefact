# Node RiffRaff Artefact

Plugin for building deployable RiffRaff artefacts in Node. Supports RiffRaff deployment types:

- `cloud-formation`
- `aws-lambda`
- `autoscaling`

## Getting Started
This is a node plugin for creating [RiffRaff](https://github.com/guardian/deploy) artefacts that can then be deployed by RiffRaff. It builds the same package structure as the [SBT](https://github.com/guardian/riffraff-artifact) equivalent.

To use it, ensure you have a `package.json` located in the root directory of your project. There must be at the very minimum the `name` field.

### Options
- `isAwsLambda`: `true` or `false` (optional - defaults to `false`)
- `cloudformation`: `false` or the location of your cloudformation (optional - defaults to `cloudformation.json`)
- `projectName`: a string with the name you want to appear in RiffRaff dropdown (e.g. `team::project` - defaults to `name` in package.json)

Some example `package.json`:

#### Autoscaling deploy with Cloudformation
```json
{
  "name": "s3watcher",
  "...": "...",
  "cloudformation": "my_clouformation.json"
}
```

#### AWS Lambda deploy without Cloudformation
```json
{
  "name": "s3watcher",
  "...": "...",
  "isAwsLambda": true,
  "cloudformation": false
}
```

You should also have a `deploy.json` in your root directory that can be read by RiffRaff, although the plugin will work without one.

Once you've set up the equivalent package.json, you will need to add an npm task ```riffraff-artefact```. Running this will then generate the artefact for you and upload it to S3.

You may then wish to add build hooks into whatever continuous deployment you're using to deploy your artefact.

You can enable more verbose logging setting the environment variable `VERBOSE=true`.

### Configuring the Default build directory
By default, this plugin will build the tgz file from the default directory (the root). You can configure this by setting `buildDir` to whatever you want in the package.json file. Note that this is the root directory that node will be run on. So a `package.json` with relevant run scripts must be present.

### Build environment support
Works on:
- [Circle CI](https://circleci.com/)
- [Travis](https://travis-ci.org/)
- [Jenkins](https://jenkins-ci.org/) with the [Git plugin](https://wiki.jenkins-ci.org/display/JENKINS/Git+Plugin)
- Teamcity. Note - you need to manually pass the branch name as an environment variable. Under Parameters, create an environment variable called `TEAMCITY_BRANCH` with the value `teamcity.build.vcs.branch.<your build configuration ID>`

If you want to support other continuous integration tools, have a look at `settings.js` and configure the relevant environment variables to get information about the build.

### Contributing

* Clone
* Update the code
* `npm build`
* Commit
