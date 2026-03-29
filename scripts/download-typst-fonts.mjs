import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "core", "typst-fonts");
const fontBaseUrl = "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts";
const noticeUrl = "https://raw.githubusercontent.com/typst/typst-assets/v0.13.1/NOTICE";

const files = [
  "DejaVuSansMono-Bold.ttf",
  "DejaVuSansMono-BoldOblique.ttf",
  "DejaVuSansMono-Oblique.ttf",
  "DejaVuSansMono.ttf",
  "LibertinusSerif-Bold.otf",
  "LibertinusSerif-BoldItalic.otf",
  "LibertinusSerif-Italic.otf",
  "LibertinusSerif-Regular.otf",
  "LibertinusSerif-Semibold.otf",
  "LibertinusSerif-SemiboldItalic.otf",
  "NewCM10-Bold.otf",
  "NewCM10-BoldItalic.otf",
  "NewCM10-Italic.otf",
  "NewCM10-Regular.otf",
  "NewCMMath-Bold.otf",
  "NewCMMath-Book.otf",
  "NewCMMath-Regular.otf",
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
}

await mkdir(outputDir, { recursive: true });

for (const fileName of files) {
  const destination = path.join(outputDir, fileName);
  if (await fileExists(destination)) {
    continue;
  }

  await downloadFile(`${fontBaseUrl}/${fileName}`, destination);
}

const noticeDestination = path.join(outputDir, "NOTICE.txt");
if (!(await fileExists(noticeDestination))) {
  await downloadFile(noticeUrl, noticeDestination);
}

console.log(`Typst fonts are available in ${outputDir}`);