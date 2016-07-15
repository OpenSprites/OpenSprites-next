<p align='center'>
  <a href='#'><img src='https://raw.githubusercontent.com/OpenSprites/OpenSprites-next/master/screenshot.png'></a>
</p>

## What is?
OpenSprites is the place where [Scratchers](https://wiki.scratch.mit.edu/wiki/Scratcher) can upload and download super-cool resources to use in their projects, with new stuff being added daily by users all over the globe.

## Installation
To start, install:
- [Node.js](https://nodejs.org/)
- [node-gyp](https://github.com/nodejs/node-gyp#installation)
- [MongoDB](https://www.mongodb.com/download-center#community) (or use [mLab](https://mlab.com/))
- [sox](http://sox.sourceforge.net/) with the [mp3 format for sox](http://superuser.com/a/421168) [(windows)](http://stackoverflow.com/a/23939403)

Follow the prerequisites for building node-canvas. Find the instructions for your OS [here](https://github.com/Automattic/node-canvas/wiki)  
If you have Python 3 installed already, you can install a portable version of python 2.7 and replace the PATH entry.

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

```yaml
db_host=localhost
db_name=next
db_user=username
db_pass=password

db_file_storage=true

project_id=115307769
session_secret=thisandagainplsexplain

server_port=3000
```

(Don't set `project_id` to not require a Scratch account to join.)

(Set `db_file_storage` to false to store uploads on the local filesystem instead of in mongo.)

# Usage

To *transpile and minify* assets, use `npm run build`.  

To *watch for file changes*, use `npm run watch`. This will watch for file changes and then transpile and minify assets.  

To *run the server*, use `npm start` and open up [localhost:3000](http://localhost:3000/). **Make sure you have MongoDB running**, too.
