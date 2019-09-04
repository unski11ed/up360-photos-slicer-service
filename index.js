const express = require('express');
const sharp = require('sharp');
const path = require('path');
const { isNumber, map } = require('lodash');
const fs = require('fs');

const PORT = process.env['PORT'] || 8000;
const HOST = process.env['HOST'] || '0.0.0.0';
const PHOTOS_PATH_BASE = process.env['PHOTOS_PATH_BASE']
    || path.resolve(__dirname, 'photos');

const app = new express();

app.get('/:photo/:fileNameWExt', (req, res) => {
    const { photo, fileNameWExt } = req.params;

    if (!(photo || fileNameWExt)) {
        res.status(404)
            .send('Wrong params provided');
    }
    const [fileName, fileExt] = fileNameWExt.split('.');
    const fileNameParts = fileName.split('_');

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
    const inputImageStream = fs.createReadStream(photoFilePath);

    inputImageStream.on('error', () => {
        res.status(404)
            .send('File not found')
            .end();
    });

    if (inputImageStream) {
        // Create transformation func
        const left = Math.floor(column / totalColumns * resX);
        const top = Math.floor(row / totalRows * resY);
        const width = Math.round(1 / totalColumns * resX);
        const height = Math.round(1 / totalRows * resY);

        const transform = sharp()
            .resize(resX, resY)
            .extract({ left, top, width, height })
            .jpeg({ quality: 90 });

        // Transform and pass to response
        inputImageStream.pipe(transform).pipe(res);

        return inputImageStream;
    }
});

app.listen(PORT, HOST);