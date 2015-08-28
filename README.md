# Node RiffRaff Artefact

Plugin for building deployable RiffRaff artefacts in Node.

**This is currently in Beta and does not work correctly. Speak to @hmgibson if you literally can't wait more than 5 minutes to use it.**

## Getting Started
This is a node plugin for creating
[RiffRaff](https://github.com/guardian/deploy)
artefacts that can then
be deployed by RiffRaff. It builds the same package structure as the
[SBT](https://github.com/guardian/riffraff-artifact) equivalent.

To use it, ensure you have a ```package.json``` located in the root
directoy of your project. There must be at the very minimum the
fields: ```name``` (the name of your application) and
```cloudformation``` (the location of your cloudformation script
file).

You should also have a ```deploy.json``` in your root directory that
can be read by RiffRaff, although the plugin will work without one.

Once you've set up the equivalent package.json, you will need to add
an npm task ```riffraff-artefact```. Running this will then generate
the artefact for you and upload it to S3.

You may then wish to add build hooks into whatever continuous
deployment you're using to deploy your artefact.

### Configuring the Default build directory
By default, this plugin will build the tgz file from the default
directory (the root). You can configure this by setting ```buildDir```
to whatever you want in the package.json file. Note that this is the
root directory that node will be run on. So a package.json with
relevant run scripts must be present.
