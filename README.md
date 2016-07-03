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

Then, in a Terminal or Command Prompt window:

```sh
git clone https://github.com/OpenSprites/OpenSprites-next.git opensprites-next
cd opensprites-next
npm install
```

Lastly, setup a `.env` file in this format, making sure to create the respective database and username/password:

```
db_host=localhost
db_name=next
db_user=username
db_pass=password

project_id=115307769
resources_name=Stuff
session_secret=thisandagainplsexplain
```

(Don't set `project_id` to not require a Scratch account to join.)

# Usage

To *transpile and minify* assets, use `npm run build`.  

To *watch for file changes*, use `npm run watch`. This will watch for file changes and then transpile and minify assets.  

To *run the server*, use `npm start` and open up [localhost:3000](http://localhost:3000/). **Make sure you have MongoDB running**, too.