<p align='center'>
  <img src='https://raw.githubusercontent.com/OpenSprites/OpenSprites/master/Logo%20designs%20and%20mockups/os-logo.svg'>
</p>

## Installation, Usage, & Setup
Make sure you have both [Node.js](https://nodejs.org/) and [MySQL](https://mariadb.org/) installed.
In Terminal / Command Prompt:

```sh
git clone https://github.com/OpenSprites/OpenSprites-next.git opensprites-next
cd opensprites-next
npm install
```

To **transpile and minify** resources, use `npm run build`.
To **watch for file changes**, use `npm run watch`. This will watch for file changes and then transpile/minify resources.
To **run the server**, use `npm start` and open up [localhost:3000](http://localhost:3000/).