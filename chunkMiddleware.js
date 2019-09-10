const sharp = require('sharp');
const path = require('path');
const stream = require('stream');
const { map } = require('lodash');
const fs = require('fs');
const util = require('util');

const writeFileAsync = util.promisify(fs.writeFile);

const createChunkMiddleware = (photosPath, cachePath) =>
    async (req, res, next) => {
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31557600');

        const { photo, fileNameWExt } = req.params;

        if (!(photo || fileNameWExt)) {
            res.status(404)
                .send('Wrong params provided');
        }
        const [fileName, fileExt] = fileNameWExt.split('.');
        const fileNameParts = fileName.split('_');
        const cacheFileName = path.resolve(cachePath, fileNameWExt);

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

        const photoFilePath = path.resolve(photosPath, photo, `${index}.${fileExt}`);

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

        // Transform the image and store it in a buffer
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

        // If non chunked image is requested - save it in cache
        // for faster initial load times
        if (totalRows === 1 && totalColumns === 1) {
            try {
                await writeFileAsync(cacheFileName, transformedImageBuffer);
            } catch (exc) {
                console.log('Failed to write cache file!');
            }
        }

        // Send the image buffer
        res.send(transformedImageBuffer);
    };

module.exports = { createChunkMiddleware };
