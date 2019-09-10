const express = require('express');
const mkdirp = require('mkdirp');
const path = require('path');

const { createChunkMiddleware } = require('./chunkMiddleware');

const PORT = process.env['PORT'] || 8000;
const HOST = process.env['HOST'] || '0.0.0.0';
const PHOTOS_PATH_BASE = process.env['PHOTOS_PATH_BASE']
    || path.resolve(__dirname, 'photos');
const CACHE_PATH = process.env['CACHE_PATH']
    || path.resolve(__dirname, 'cache');

const app = new express();

app.use('/:photo/:fileNameWExt',
    createChunkMiddleware(PHOTOS_PATH_BASE, CACHE_PATH),
);

// Bootstrap
mkdirp(CACHE_PATH, (err) => {
    if (err) {
        throw new Error('Failed to create cache folder');
    }

    app.listen(PORT, HOST);
});