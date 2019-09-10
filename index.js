const express = require('express');
const sharp = require('sharp');
const path = require('path');
const stream = require('stream');
const mkdirp = require('mkdirp');
const { map } = require('lodash');
const util = require('util');
const fs = require('fs');

const PORT = process.env['PORT'] || 8000;
const HOST = process.env['HOST'] || '0.0.0.0';
const PHOTOS_PATH_BASE = process.env['PHOTOS_PATH_BASE']
    || path.resolve(__dirname, 'photos');
const CACHE_PATH = process.env['CACHE_PATH']
    || path.resolve(__dirname, 'cache');

const app = new express();
const pipeline = util.promisify(stream.pipeline);

app.get('/:photo/:fileNameWExt', async (req, res, next) => {
    const { photo, fileNameWExt } = req.params;

    if (!(photo || fileNameWExt)) {
        res.status(404)
            .send('Wrong params provided');
    }
    const [fileName, fileExt] = fileNameWExt.split('.');
    const fileNameParts = fileName.split('_');
    const cacheFileName = path.resolve(CACHE_PATH, fileNameWExt);

    // Check if file is cached and push it to the response if it is
    if (fs.existsSync(cacheFileName)) {
        const cacheImageStream = fs.createReadStream(cacheFileName);

        cacheImageStream.pipe(res);

        return;
    }

    // Check if all file parts are numbers (some format checking)
    if (!fileNameParts.reduce((acc, val) => acc && !isNaN(val), true)) {
        res.status(400)
            .send('Improper filename format');
    }

    const [
        index,
        column,
        row,
        totalColumns,
        totalRows,
        resX,
        resY,
    ] = map(fileNameParts, value => parseInt(value));

    const photoFilePath = path.resolve(PHOTOS_PATH_BASE, photo, `${index}.${fileExt}`);

    // Finish if file does not exit
    if (!fs.existsSync(photoFilePath)) {
        res.status(404)
            .send('File not found')
            .end();

        return;
    }

    // Create transformation func
    const left = Math.floor(column / totalColumns * resX);
    const top = Math.floor(row / totalRows * resY);
    const width = Math.round(1 / totalColumns * resX);
    const height = Math.round(1 / totalRows * resY);

    let transformedImageBuffer;
    
    try {
        transformedImageBuffer = await sharp(photoFilePath)
            .resize(resX, resY)
            .extract({ left, top, width, height })
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (exc) {
        next(exc);
    }

    const transformedImageStream = new stream.PassThrough();
    transformedImageStream.end(transformedImageBuffer);

    // If non chunked image is requested - save it in cache
    // for faster initial load times
    if (totalRows === 1 && totalColumns === 1) {
        const cacheWriteStream = fs.createWriteStream(cacheFileName);
        
        transformedImageStream.pipe(cacheWriteStream);
    }

    // Transform and pass to response
    transformedImageStream.pipe(res);
});


// Bootstrap
mkdirp(CACHE_PATH, (err) => {
    if (err) {
        throw new Error('Failed to create cache folder');
    }

    app.listen(PORT, HOST);
});