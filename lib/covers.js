import "dotenv/config";
import debug from "debug";
import chalk from "chalk";
import fs from "fs/promises";
import { execFile } from "child_process";
import "path";
import { ImagePool } from "@squoosh/lib";

const imagePool = new ImagePool();

const dbg = debug("covers");

const coversPath = process.env.COVERS_PATH;
const coversRclone = process.env.COVERS_RCLONE;

const OPERATION_BATCH_SIZE = 10;

export async function createCovers(books) {
  const existingImages = await getExistingCoverImages();
  const missing = [];
  for (const book of books) {
    const idx = existingImages.indexOf(`${book.id}.jpg`);
    if (idx == -1) {
      missing.push(book.id);
      await squooshCoverToId(book.path, book.id);
    }
  }
  await imagePool.close();
  if (missing.length > 0) {
    uploadCovers();
  }
}

async function getExistingCoverImages() {
  const images = await fs.readdir(coversPath);
  dbg("Getting images list...");
  return images;
}

async function squooshCoverToId(path, id) {
  try {
    const img = path + "/cover.jpg";
    const file = await fs.readFile(img);
    const image = imagePool.ingestImage(file);
    await image.preprocess({
      resize: {
        enabled: true,
        width: 512,
      },
    });
    await image.encode({
      // All codecs are initialized with default values
      // that can be individually overwritten.
      mozjpeg: {
        quality: 50,
      },
    });    
    
    const { extension, binary } = await image.encodedWith.mozjpeg;
    await fs.writeFile(`${coversPath}${id}.${extension}`, binary);
  } catch(err) {
    console.log(err);
  }
}

function uploadCovers() {
  execFile(
      'rclone',
      [
        'copy',
        coversPath,
        coversRclone,
        '-v'
      ], (error, stdout, stderr) => {
      if (error) {
          console.log('stderr', stderr);
          throw error;
      }
      console.log(chalk.green(`\nUploaded:\n${stderr}`));
  });
}
