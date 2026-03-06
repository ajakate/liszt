import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import * as path from 'path';

interface BookMetadata {
  title: string;
  author: string;
}

export function extractEpubMetadata(filePath: string): BookMetadata {
  const zip = new AdmZip(filePath);

  // Find the .opf file via container.xml
  const containerXml = zip.readAsText('META-INF/container.xml');
  const $container = cheerio.load(containerXml, { xmlMode: true });
  const opfPath = $container('rootfile').attr('full-path') || '';

  const opfContent = zip.readAsText(opfPath);
  const $opf = cheerio.load(opfContent, { xmlMode: true });

  const title = $opf('dc\\:title, title').first().text() || path.basename(filePath, '.epub');
  const author = $opf('dc\\:creator, creator').first().text() || 'Unknown';

  return { title, author };
}

export function extractEpubText(filePath: string): string {
  const zip = new AdmZip(filePath);

  // Find the .opf file via container.xml
  const containerXml = zip.readAsText('META-INF/container.xml');
  const $container = cheerio.load(containerXml, { xmlMode: true });
  const opfPath = $container('rootfile').attr('full-path') || '';
  const opfDir = path.dirname(opfPath);

  const opfContent = zip.readAsText(opfPath);
  const $opf = cheerio.load(opfContent, { xmlMode: true });

  // Get spine order
  const spineItems: string[] = [];
  $opf('spine itemref').each((_i, el) => {
    const idref = $opf(el).attr('idref');
    if (idref) spineItems.push(idref);
  });

  // Build manifest map (id -> href)
  const manifest: Record<string, string> = {};
  $opf('manifest item').each((_i, el) => {
    const id = $opf(el).attr('id');
    const href = $opf(el).attr('href');
    const mediaType = $opf(el).attr('media-type') || '';
    if (id && href && mediaType.includes('html')) {
      manifest[id] = href;
    }
  });

  // Extract text from each chapter in spine order
  const textParts: string[] = [];

  for (const itemId of spineItems) {
    const href = manifest[itemId];
    if (!href) continue;

    const entryPath = opfDir ? `${opfDir}/${href}` : href;
    const entry = zip.getEntry(entryPath) || zip.getEntry(decodeURIComponent(entryPath));
    if (!entry) continue;

    const html = zip.readAsText(entry.entryName);
    const $ = cheerio.load(html);

    // Remove scripts, styles, and other non-content elements
    $('script, style, head').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (text) {
      textParts.push(text);
    }
  }

  return textParts.join('\n\n');
}
