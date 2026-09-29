'use strict';

const path = require('path');
const Crypto = require('crypto');
const { tmpdir } = require('os');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const webp = require('node-webpmux');
const fs = require('fs').promises;
const MessageMedia = require('../structures/MessageMedia');
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Utility methods
 */
class Util {
    constructor() {
        throw new Error(
            `The ${this.constructor.name} class may not be instantiated.`,
        );
    }

    static generateHash(length) {
        var result = '';
        var characters =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(
                Math.floor(Math.random() * charactersLength),
            );
        }
        return result;
    }

    /**
     * Sets default properties on an object that aren't already specified.
     * @param {Object} def Default properties
     * @param {Object} given Object to assign defaults to
     * @returns {Object}
     * @private
     */
    static mergeDefault(def, given) {
        if (!given) return def;
        for (const key in def) {
            if (!has(given, key) || given[key] === undefined) {
                given[key] = def[key];
            } else if (given[key] === Object(given[key])) {
                given[key] = Util.mergeDefault(def[key], given[key]);
            }
        }

        return given;
    }

    /**
     * Formats a image to webp
     * @param {MessageMedia} media
     *
     * @returns {Promise<MessageMedia>} media in webp format
     */
    static async formatImageToWebpSticker(media, pupPage) {
        if (!media.mimetype.includes('image'))
            throw new Error('media is not a image');

        if (media.mimetype.includes('webp')) {
            return media;
        }

        return pupPage.evaluate((media) => {
            return window.WWebJS.toStickerData(media);
        }, media);
    }

    /**
     * Formats a video to webp
     * @param {MessageMedia} media
     *
     * @returns {Promise<MessageMedia>} media in webp format
     */
    static async formatVideoToWebpSticker(media) {
        if (!media.mimetype.includes('video'))
            throw new Error('media is not a video');

        const videoType = media.mimetype.split('/')[1];

        const tempFile = path.join(
            tmpdir(),
            `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`,
        );

        const stream = new (require('stream').Readable)();
        const buffer = Buffer.from(
            media.data.replace(`data:${media.mimetype};base64,`, ''),
            'base64',
        );
        stream.push(buffer);
        stream.push(null);

        await new Promise((resolve, reject) => {
            ffmpeg(stream)
                .inputFormat(videoType)
                .on('error', reject)
                .on('end', () => resolve(true))
                .addOutputOptions([
                    '-vcodec',
                    'libwebp',
                    '-vf',
                    // eslint-disable-next-line no-useless-escape
                    "scale='iw*min(300/iw\,300/ih)':'ih*min(300/iw\,300/ih)',format=rgba,pad=300:300:'(300-iw)/2':'(300-ih)/2':'#00000000',setsar=1,fps=10",
                    '-loop',
                    '0',
                    '-ss',
                    '00:00:00.0',
                    '-t',
                    '00:00:05.0',
                    '-preset',
                    'default',
                    '-an',
                    '-vsync',
                    '0',
                    '-s',
                    '512:512',
                ])
                .toFormat('webp')
                .save(tempFile);
        });

        const data = await fs.readFile(tempFile, 'base64');
        await fs.unlink(tempFile);

        return {
            mimetype: 'image/webp',
            data: data,
            filename: media.filename,
        };
    }

    /**
     * Sticker metadata.
     * @typedef {Object} StickerMetadata
     * @property {string} [name]
     * @property {string} [author]
     * @property {string[]} [categories]
     */

    /**
     * Formats a media to webp
     * @param {MessageMedia} media
     * @param {StickerMetadata} metadata
     *
     * @returns {Promise<MessageMedia>} media in webp format
     */
    static async formatToWebpSticker(media, metadata, pupPage) {
        const webpMedia = await this._mediaToWebp(media, pupPage);

        if (metadata.name || metadata.author) {
            const buffer = await this._writeStickerExif(
                Buffer.from(webpMedia.data, 'base64'),
                {
                    'sticker-pack-id': this.generateHash(32),
                    'sticker-pack-name': metadata.name,
                    'sticker-pack-publisher': metadata.author,
                    emojis: metadata.categories || [''],
                },
            );
            webpMedia.data = buffer.toString('base64');
        }

        return webpMedia;
    }

    /**
     * Converts an image or video media into a webp sticker.
     * @param {MessageMedia} media
     * @param {import('puppeteer').Page} pupPage
     * @returns {Promise<MessageMedia>} media in webp format
     * @private
     */
    static async _mediaToWebp(media, pupPage) {
        if (media.mimetype.includes('image'))
            return this.formatImageToWebpSticker(media, pupPage);
        if (media.mimetype.includes('video'))
            return this.formatVideoToWebpSticker(media);
        throw new Error('Invalid media format');
    }

    /**
     * Writes WhatsApp sticker EXIF metadata (a JSON blob) into a webp buffer.
     * @param {Buffer} buffer raw webp data
     * @param {Object} json metadata written into the EXIF chunk
     * @returns {Promise<Buffer>} webp buffer with the EXIF chunk applied
     * @private
     */
    static async _writeStickerExif(buffer, json) {
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41,
            0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);
        const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
        const exif = Buffer.concat([exifAttr, jsonBuffer]);
        exif.writeUIntLE(jsonBuffer.length, 14, 4);

        const img = new webp.Image();
        await img.load(buffer);
        img.exif = exif;
        return img.save(null);
    }

    /**
     * Reads sticker EXIF metadata and the animation flag from a webp buffer.
     * @param {Buffer} buffer
     * @returns {Promise<{metadata: Object|null, isAnimated: boolean}>}
     * @private
     */
    static async _inspectWebpSticker(buffer) {
        const img = new webp.Image();
        await img.load(buffer);

        let metadata = null;
        if (img.exif) {
            const text = img.exif.toString('utf8');
            const start = text.indexOf('{');
            if (start !== -1) {
                try {
                    metadata = JSON.parse(text.slice(start));
                } catch (ignoredError) {
                    metadata = null;
                }
            }
        }

        return { metadata, isAnimated: Boolean(img.anim?.frames?.length) };
    }

    /**
     * Zips the given named buffers into a single zip buffer.
     * @param {{name: string, buffer: Buffer}[]} entries
     * @returns {Promise<Buffer>}
     * @private
     */
    static _zip(entries) {
        let archiver;
        try {
            archiver = require('archiver');
        } catch {
            throw new Error(
                'sendMediaAsStickerPack requires the optional "archiver" package. Install it with: npm install archiver',
            );
        }
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', { zlib: { level: 9 } });
            const stream = new PassThrough();
            const chunks = [];

            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
            archive.on('error', reject);
            archive.on('warning', reject);

            archive.pipe(stream);
            entries.forEach(({ name, buffer }) =>
                archive.append(buffer, { name }),
            );
            archive.finalize();
        });
    }

    /**
     * Formats an array of media into a native sticker pack payload.
     * @param {MessageMedia[]} mediaList
     * @param {Object} metadata
     * @param {string} metadata.name - sticker pack name (required)
     * @param {string} [metadata.publisher]
     * @param {string} [metadata.id] - defaults to a random UUID
     * @param {string[]} [metadata.categories] - emoji categories applied to every sticker
     * @param {?MessageMedia} [metadata.trayIcon] - image used as the tray icon; defaults to the first sticker
     * @param {import('puppeteer').Page} pupPage
     * @returns {Promise<Object>} sticker pack payload consumed by the injected uploader
     */
    static async formatToWebpStickerPack(mediaList, metadata, pupPage) {
        if (!Array.isArray(mediaList) || mediaList.length === 0) {
            throw new Error(
                'sendMediaAsStickerPack requires a non-empty array of MessageMedia',
            );
        }
        if (mediaList.some((media) => !(media instanceof MessageMedia))) {
            throw new Error(
                'sendMediaAsStickerPack requires a non-empty array of MessageMedia',
            );
        }

        const name = (metadata.name || '').trim();
        if (!name) throw new Error('stickerPackName is required');

        if (metadata.trayIcon != null) {
            if (!(metadata.trayIcon instanceof MessageMedia))
                throw new Error(
                    'Sticker pack tray icon must be a MessageMedia',
                );
            if (!metadata.trayIcon.mimetype.includes('image'))
                throw new Error('Sticker pack tray icon must be an image');
        }

        const id = metadata.id || Crypto.randomUUID();
        const publisher = metadata.publisher || '';
        const categories = Array.isArray(metadata.categories)
            ? metadata.categories
            : undefined;
        const trayIconFileName = `${id}.png`;

        const stickers = [];
        for (const media of mediaList) {
            const webpMedia = await this._mediaToWebp(media, pupPage);
            const source = Buffer.from(webpMedia.data, 'base64');
            const { metadata: original, isAnimated } =
                await this._inspectWebpSticker(source);

            const emojis =
                categories ||
                (Array.isArray(original?.emojis) ? original.emojis : undefined);
            const json = {
                'sticker-pack-id': id,
                'sticker-pack-name': name,
                'sticker-pack-publisher': publisher,
            };
            if (Array.isArray(emojis)) json.emojis = emojis;
            json['is-from-user-created-pack'] = 1;

            const buffer = await this._writeStickerExif(source, json);
            const fileName = `${Crypto.createHash('sha256')
                .update(buffer)
                .digest('base64')
                .replace(/\//g, '-')}.webp`;

            stickers.push({
                buffer,
                fileName,
                emojis: emojis || [],
                isAnimated,
                isLottie: false,
                mimetype: 'image/webp',
                accessibilityLabel: '',
            });
        }

        const crop = (media, options) =>
            pupPage.evaluate(
                (m, o) => window.WWebJS.cropAndResizeImage(m, o),
                media,
                options,
            );
        const asMediaInfo = (sticker) => ({
            mimetype: 'image/webp',
            data: sticker.buffer.toString('base64'),
            filename: sticker.fileName,
        });

        const trayIcon = await crop(
            metadata.trayIcon || asMediaInfo(stickers[0]),
            {
                mimetype: 'image/png',
                size: 64,
            },
        );
        trayIcon.filename = trayIconFileName;

        const thumbnail = await pupPage.evaluate(
            (medias, o) => window.WWebJS.createStickerPackPreview(medias, o),
            stickers.map(asMediaInfo),
            { mimetype: 'image/jpeg', size: 252, quality: 0.79 },
        );
        thumbnail.filename = `${id}.jpg`;

        const trayIconBuffer = Buffer.from(trayIcon.data, 'base64');
        const thumbnailBuffer = Buffer.from(thumbnail.data, 'base64');
        const stickerPackSize =
            trayIconBuffer.length +
            stickers.reduce((total, s) => total + s.buffer.length, 0);
        const zipBuffer = await this._zip([
            ...stickers.map((s) => ({ name: s.fileName, buffer: s.buffer })),
            { name: trayIconFileName, buffer: trayIconBuffer },
        ]);

        return {
            media: new MessageMedia(
                'application/zip',
                zipBuffer.toString('base64'),
                name,
                zipBuffer.length,
            ),
            thumbnail: new MessageMedia(
                'image/jpeg',
                thumbnail.data,
                thumbnail.filename,
                thumbnailBuffer.length,
            ),
            stickerPackId: id,
            stickerPackName: name,
            stickerPackPublisher: publisher,
            stickerPackDescription: '',
            stickerPackSize,
            trayIconFileName,
            stickers: stickers.map((s) => ({
                fileName: s.fileName,
                emojis: s.emojis,
                isLottie: s.isLottie,
                mimetype: s.mimetype,
                isAnimated: s.isAnimated,
                accessibilityLabel: s.accessibilityLabel,
            })),
        };
    }

    /**
     * Configure ffmpeg path
     * @param {string} path
     */
    static setFfmpegPath(path) {
        ffmpeg.setFfmpegPath(path);
    }
}

module.exports = Util;
