const fs = require('fs');
const path = require('path');
const { render } = require('takumi-js');
const sharp = require('sharp');

const SITE_URL = (process.env.SITE_URL || 'https://wwebjs.dev').replace(
    /\/$/,
    '',
);
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_DIR = path.join(DOCS_DIR, 'images', 'og-gen');
const ASSETS_DIR = path.join(__dirname, 'og-assets');

function getPageSlug(fileName) {
    let cleanName = fileName.replace(/\.html$/, '');
    if (cleanName.toLowerCase() === 'index') return 'index';
    return cleanName.replace(/[/_\s]+/g, '-').toLowerCase();
}

function cleanText(str) {
    if (!str) return '';
    return String(str)
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/&#(?:039|39|x27);|&apos;/g, "'")
        .replace(/&#(?:034|34|x22);|&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPageMeta(htmlContent) {
    // Extract title
    let title = '';
    const titleMatch = htmlContent.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        const rawTitle = cleanText(titleMatch[1]);
        if (rawTitle.includes('»')) {
            title = rawTitle.split('»').pop().trim();
        } else if (rawTitle.includes('&raquo;')) {
            title = rawTitle.split('&raquo;').pop().trim();
        } else {
            title = rawTitle;
        }
    }

    if (
        !title ||
        title.toLowerCase() === 'home' ||
        title.toLowerCase().includes('whatsapp-web.js')
    ) {
        title = 'whatsapp-web.js';
    }

    // Extract description
    let description = '';
    const classDescMatch = htmlContent.match(
        /<div\s+class="symbol-classdesc">([\s\S]*?)<\/div>/i,
    );
    const summaryDescMatch = htmlContent.match(
        /<div\s+class="symbol-description">([\s\S]*?)<\/div>/i,
    );

    if (classDescMatch) {
        description = cleanText(classDescMatch[1]);
    } else if (summaryDescMatch) {
        description = cleanText(summaryDescMatch[1]);
    }

    if (!description) {
        description = 'A WhatsApp client library for NodeJS';
    }

    if (description.length > 130) {
        description = description.substring(0, 127) + '...';
    }

    return { title, description };
}

function createTextOverlayHtml({ title }) {
    const displayTitle = cleanText(title).replace(/^Class:\s*/i, '');

    return `
    <div style="
      position: relative;
      width: 1834px;
      height: 963px;
      display: flex;
    ">
      <div style="
        position: absolute;
        left: 103px;
        top: 493px;
        width: 1518px;
        display: flex;
        flex-direction: column;
      ">
        <div style="
          font-family: 'Archivo Black';
          font-size: 120px;
          letter-spacing: -0.04em;
          line-height: 1.1;
          text-align: left;
          padding-left: 4px;
          color: #ffffff;
        ">${displayTitle}</div>
      </div>
    </div>
  `;
}

function updateHtmlMetaTags(htmlContent, { title, description, imageUrl }) {
    let updatedHtml = htmlContent;

    const metaTags = [
        `<meta property="og:type" content="website">`,
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:description" content="${description}">`,
        `<meta property="og:image" content="${imageUrl}">`,
        `<meta property="og:image:width" content="1834">`,
        `<meta property="og:image:height" content="963">`,
        `<meta name="twitter:card" content="summary_large_image">`,
        `<meta name="twitter:image" content="${imageUrl}">`,
    ].join('\n\t\t');

    // Remove existing OG & Twitter meta tags to prevent duplication
    updatedHtml = updatedHtml.replace(
        /\s*<meta\s+property="og:[^"]*"\s+content="[^"]*">\s*/gi,
        '\n',
    );
    updatedHtml = updatedHtml.replace(
        /\s*<meta\s+name="twitter:[^"]*"\s+content="[^"]*">\s*/gi,
        '\n',
    );

    // Insert before </head>
    if (updatedHtml.includes('</head>')) {
        updatedHtml = updatedHtml.replace(
            '</head>',
            `\t\t${metaTags}\n\t</head>`,
        );
    }

    return updatedHtml;
}

async function main() {
    if (!fs.existsSync(DOCS_DIR)) {
        console.error(`Docs directory not found at: ${DOCS_DIR}`);
        process.exit(1);
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const archivoPath = path.join(ASSETS_DIR, 'ArchivoBlack-Regular.ttf');
    const templatePath = path.join(ASSETS_DIR, 'og-template.png');
    const indexTemplatePath = path.join(ASSETS_DIR, 'index-template.png');

    if (!fs.existsSync(archivoPath) || !fs.existsSync(templatePath)) {
        console.error('Missing required OG assets in tools/og-assets/!');
        process.exit(1);
    }

    const archivoFont = fs.readFileSync(archivoPath);

    // Pre-resize background template image to standard 1834x963 resolution
    const resizedBgBuffer = await sharp(templatePath)
        .resize(1834, 963, { fit: 'cover' })
        .toBuffer();

    const files = fs
        .readdirSync(DOCS_DIR)
        .filter((f) => f.endsWith('.html') && !f.endsWith('.js.html'));

    console.log(`Generating Open Graph cards for ${files.length} doc files...`);

    for (const file of files) {
        const filePath = path.join(DOCS_DIR, file);
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const slug = getPageSlug(file);
        const { title, description } = extractPageMeta(htmlContent);
        const imageUrl = `${SITE_URL}/docs/images/og-gen/${slug}.png`;

        console.log(
            `Processing [${file}] -> Title: "${title}" | Slug: "${slug}"`,
        );

        let finalImageBuffer;

        if (slug === 'index' && fs.existsSync(indexTemplatePath)) {
            // Compress and resize the custom index page image using sharp
            finalImageBuffer = await sharp(indexTemplatePath)
                .resize(1834, 963, { fit: 'cover' })
                .png({ quality: 95, compressionLevel: 9 })
                .toBuffer();
        } else {
            const overlayHtml = createTextOverlayHtml({ title });

            // Render text typography overlay via takumi-js
            const textOverlayBuffer = await render(overlayHtml, {
                width: 1834,
                height: 963,
                fonts: [
                    {
                        name: 'Archivo Black',
                        data: archivoFont,
                        weight: 400,
                        style: 'normal',
                    },
                ],
            });

            // Composite text overlay over background template using sharp
            finalImageBuffer = await sharp(resizedBgBuffer)
                .composite([{ input: textOverlayBuffer, top: 0, left: 0 }])
                .png({ quality: 95 })
                .toBuffer();
        }

        const outputImagePath = path.join(OUTPUT_DIR, `${slug}.png`);
        fs.writeFileSync(outputImagePath, finalImageBuffer);

        // Update HTML file with Open Graph meta tags
        const updatedHtml = updateHtmlMetaTags(htmlContent, {
            title,
            description,
            imageUrl,
        });
        fs.writeFileSync(filePath, updatedHtml, 'utf8');
    }

    console.log(
        `Successfully generated Open Graph images & updated metadata for ${files.length} pages.`,
    );
}

main().catch((err) => {
    console.error('Failed to generate Open Graph images:', err);
    process.exit(1);
});
