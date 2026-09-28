const fs = require('fs');
const path = require('path');
const https = require('https');

const assetsDir = path.join(__dirname, 'og-assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Copy user uploaded template images if exist
const uploadedOgTemplate =
    'C:\\Users\\Tino\\.gemini\\antigravity\\brain\\593e3aac-45d7-4961-868f-5ba7c1cfafe7\\.user_uploaded\\media_1785849331092.png';
const uploadedIndexTemplate =
    'C:\\Users\\Tino\\.gemini\\antigravity\\brain\\38311d14-ef3b-4443-8890-de62fed00daf\\.user_uploaded\\media_1785875191856.png';

const targetOgTemplate = path.join(assetsDir, 'og-template.png');
const targetIndexTemplate = path.join(assetsDir, 'index-template.png');

if (fs.existsSync(uploadedOgTemplate)) {
    fs.copyFileSync(uploadedOgTemplate, targetOgTemplate);
    console.log(`Copied template image to ${targetOgTemplate}`);
}
if (fs.existsSync(uploadedIndexTemplate)) {
    fs.copyFileSync(uploadedIndexTemplate, targetIndexTemplate);
    console.log(`Copied index template image to ${targetIndexTemplate}`);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https
            .get(url, (response) => {
                if (
                    response.statusCode === 302 ||
                    response.statusCode === 301
                ) {
                    return downloadFile(response.headers.location, dest)
                        .then(resolve)
                        .catch(reject);
                }
                if (response.statusCode !== 200) {
                    return reject(
                        new Error(
                            `Failed to download ${url}: status ${response.statusCode}`,
                        ),
                    );
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve());
                });
            })
            .on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
    });
}

async function main() {
    const fonts = [
        {
            name: 'ArchivoBlack-Regular.ttf',
            url: 'https://raw.githubusercontent.com/mrhoodz/wwebjs.dev/85c0ac2c1563ce05cf3002a64ead456fa52f1366/src/.vuepress/plugins/fonts/ArchivoBlack-Regular.ttf',
        },
        {
            name: 'Poppins-Medium.ttf',
            url: 'https://raw.githubusercontent.com/mrhoodz/wwebjs.dev/85c0ac2c1563ce05cf3002a64ead456fa52f1366/src/.vuepress/plugins/fonts/Poppins-Medium.ttf',
        },
    ];

    for (const font of fonts) {
        const fontPath = path.join(assetsDir, font.name);
        if (!fs.existsSync(fontPath)) {
            console.log(`Downloading ${font.name}...`);
            await downloadFile(font.url, fontPath);
            console.log(`Downloaded ${font.name}`);
        } else {
            console.log(`${font.name} already exists.`);
        }
    }
    console.log('Setup assets completed successfully.');
}

main().catch((err) => {
    console.error('Error during asset setup:', err);
    process.exit(1);
});
