<p align='center'>
  <a href='#'><img src='https://raw.githubusercontent.com/OpenSprites/OpenSprites-next/master/screenshot.png'></a>
</p>

## What is?
OpenSprites is the place where [Scratchers](https://wiki.scratch.mit.edu/wiki/Scratcher) can upload and download super-cool resources to use in their projects, with new stuff being added daily by users all over the globe.

## Installation & Usage
Make sure you have [Node.js](https://nodejs.org/) installed.
In Terminal / Command Prompt:

```sh
git clone https://github.com/OpenSprites/OpenSprites-next.git opensprites-next
cd opensprites-next
npm install
```

To **transpile and minify** resources, use `npm run build`. 
To **watch for file changes**, use `npm run watch`. This will watch for file changes and then transpile/minify resources. 
To **run the server**, use `npm start` and open up [localhost:3000](http://localhost:3000/). 