<p align='center'>
  <a href='#'><img src='https://raw.githubusercontent.com/OpenSprites/OpenSprites-next/master/screenshot.png'></a>
</p>

## What is?
OpenSprites is the place where [Scratchers](https://wiki.scratch.mit.edu/wiki/Scratcher) can upload and download super-cool resources to use in their projects, with new stuff being added daily by users all over the globe.

## Installation
To start, install:
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/download-center#community) (or use [mLab](https://mlab.com/))
- [node-gyp](https://github.com/nodejs/node-gyp#installation)
- [node-canvas](https://github.com/Automattic/node-canvas/wiki) prerequisites
- Python 2.7 (if you have Python 3 installed already, you can install a portable version of python 2.7 and replace the `$PATH` entry)
- [sox](http://sox.sourceforge.net/) with the [mp3 format for sox](http://superuser.com/a/421168) [(windows)](http://stackoverflow.com/a/23939403)

Then, in a Terminal or Command Prompt window:

```sh
git clone https://github.com/OpenSprites/OpenSprites-next.git opensprites-next
cd opensprites-next
npm install
```

If you get errors during install or the server ends up not working, you may need to rebuild native modules:
```sh
npm rebuild lwip
npm rebuild bcrypt
npm rebuild canvas
```

Lastly, setup a `.env` file in this format, making sure to create the respective database and username/password:

```sh
# MongoDB credentials
db_host=localhost
db_name=next
db_user=username
db_pass=password

# Use database to store files?
# `false` to use local filesystem
db_file_storage=true

# project id (on Scratch) for sign up page
# (remove if you don't want to require an
# existing Scratch account to sign up)
project_id=115307769

session_secret=thisandagainplsexplain
server_port=3000

sendgrid_api_key=SG.ABCxyz # remove if you don't have one

# UNIMPLEMENTED:
cubeupload_auth=false # `true` will upload as:
#cubeupload_user=username
#cubeupload_pass=password
```

# Usage

## Transpile & minify assets
```sh
npm run build
```

## Watch for file changes
And then transpile & minify assets on filechange:
```sh
npm run watch
```

## Run the server
```sh
npm start
```
And then open up [localhost:3000](http://localhost:3000/) (or whatever port you've set it to).

# Debugging the server #

First install `node-inspector`: `npm install -g node-inspector`

Then run in separate processes: `npm run watch`, `node-inspector`, and `npm run start-debug`

Then open Chrome (or a Chromium-based browser) to `http://localhost:8080/?port=5858`

- Sourcemaps partially work (open the `*.source` files)
- Some breakpoints work (in particular they don't work on ES6 syntax, eg `let`)
- REPL works (!)
