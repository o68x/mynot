import "dotenv/config";
import { Client } from "@notionhq/client";
import { createReadStream } from "fs";
import papaparse from "papaparse";
import _ from "lodash";

import debug from "debug";
import ora from "ora";
import chalk from "chalk";

const dbg = debug("library");

const OPERATION_BATCH_SIZE = 10;

const notion = new Client({ auth: process.env.NOTION_AUTH });
const calibre_books_db = process.env.NOTION_CALIBRE_BOOKS_ID;
const calibre_authors_db = process.env.NOTION_CALIBRE_AUTHORS_ID;

let firstNames = []
/**
 * Select array of targets with databases.query
 */

async function selectAuthors() {
  const config = {
    db: process.env.NOTION_CALIBRE_AUTHORS_ID,
    filter: {
      timestamp: "last_edited_time",
      last_edited_time: {
        equals: "2022-04-01"
      }
    },
  };
  const source = await (await getTargets(config.db, config.filter));
  console.log(chalk.green(`Got ${source.length} sources linked.`));

  await updateAuthors(source);
  // const target = source.map((page) => ({
  //   pageId: page.properties.READING.relation[0].id,
  //   authors: page.properties.Authors.relation
  // }));
  // console.log(target);
}

async function updateAuthors(target) {
  const targetChunks = _.chunk(target, OPERATION_BATCH_SIZE);
  for (const targetBatch of targetChunks) {
    await Promise.all(
      targetBatch.map((page) => {
        const name = page.properties.Name.title[0].text.content;
        const initial = name.slice(0, 1).toLowerCase()
        const gender = "x"
        const icon = `${process.env.IMAGES_WEB}letter-${initial}${gender}`
        notion.pages.update({
          page_id: page.id,
          icon: {
            type: "external",
            external: { url: icon },
          },
        });
      })
    );
  }
}
// https://www.notion.so/ocardinaux/Alberoni-Francesco-d35e33f255954f738b5b46e062a1e25b
async function initFirstNames() {
  const firstNamesFile = "./assets/firstnames.csv";
  const stream = createReadStream(firstNamesFile);
  const csv = papaparse.parse(stream, {
    delimiter: ",",
    header: true,
    complete: function (results) {
      // console.log(results.data);
      return firstNames = results.data;
    },
  });
}

function getGender(name) {
  let gender = "x";
  let first = null;
  if (name.split(", ").length > 1) {
    first = name.split(", ")[1].split(" ")[0]
  }
  else if (name.split("(").length > 1) {
    first = name.split("(")[1].slice(0, -1)
  }
  if (first != null) {
    const searchObj = firstNames.find((row) => row.name == first);
    gender = typeof searchObj?.gender == "undefined" ? "x" : searchObj.gender.replace("?", "").toLowerCase();
  }
  console.log(`${name} is ${gender}`)
  return gender
}

async function getTargets(db, filter) {
  const targets = [];
  let cursor = undefined;
  try {
    while (true) {
      const { results, next_cursor } = await notion.databases.query({
        database_id: db,
        start_cursor: cursor,
        sorts: [
          {
            timestamp: "last_edited_time",
            direction: "ascending"
          }
        ],
        filter: filter,
      });
      targets.push(...results);
      if (!next_cursor) {
        break;
      }
      cursor = next_cursor;
    }
  } catch (err) {
    console.error(err);
  }
  return targets;
}

(async () => {
  // await initFirstNames()
  // console.log(firstNames)
  const linkedBooks = await selectAuthors();
  // console.log(linkedBooks.length);
})();

// https://www.notion.so/ocardinaux/Say-What-You-Mean-99dab48f0bad460d96430fba4d2e0271
// https://www.notion.so/ocardinaux/f2ac232d790944c3bd289d719099122e?v=e1947670d0e34c56b90b5b36105f7aef
// https://www.notion.so/ocardinaux/Bly-Robert-27143f3a50974906948c0413dab9860f