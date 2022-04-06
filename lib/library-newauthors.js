import "dotenv/config";
import { Client } from "@notionhq/client";
import { readFile } from "fs/promises";

import debug from "debug";
import { fstat } from "fs";
const dbg = debug("authors");

const notion = new Client({ auth: process.env.NOTION_AUTH });
const calibre_authors_db = process.env.NOTION_CALIBRE_AUTHORS_ID;

// TODO: Not 100% clear about this JSON procedure
const data = await readFile(
  "./assets/firstnames.json",
  "utf-8",
  (err, string) => {
    // const data = JSON.parse(string)
    return data;
  }
);

const nameGenders = JSON.parse(data);

// Save the sex lookup table from csv file

export async function createPages(authorsToCreate, authorsToLink) {
  for (const author of authorsToCreate) {
    const pages = await Promise.all(
      authorsToCreate.map((author) => {
        const authorIconSuffix =
          getInitals(author.name).slice(0, 1).toLowerCase() +
          getSex(author.name);
        const gender = getSex(author.name);
        const req = {
          parent: { database_id: calibre_authors_db },
          icon: {
            type: "external",
            external: {
              url: `${process.env.IMAGES_WEB}letter-${authorIconSuffix}.svg`,
            },
          },
          properties: {
            Name: {
              title: [{ type: "text", text: { content: author.name } }],
            },
            id: {
              number: author.id,
            },
            gender: {
              rich_text: [{ type: "text", text: { content: gender } }],
            },
          },
        };
        const res = notion.pages.create(req);
        return res;
      })
    );
    for (const page of pages) {
      authorsToLink.push({ id: page.properties.id.number, pageId: page.id });
    }
    return authorsToLink;
  }
}

// The initials used for the icon
function getInitals(name) {
  const { firstName, lastName } = normalizeName(name);
  const fnInitials = firstName
    .split(" ")
    .map((n) => {
      n.slice(0, 1);
    })
    .join();
  const lnInitials = lastName.slice(0, 1);
  return lnInitials + fnInitials;
}

function getSex(name) {
  let gender = "x";
  const { firstName, lastName } = normalizeName(name);
  const firstNames = firstName.split(" ");
  // Check until some result
  for (const firstName of firstNames) {
    if (firstName.length > 2) {
      const searchObj = nameGenders.filter((row) => row.name == firstName)[0];
      if (typeof searchObj?.gender != "undefined") {
        gender = searchObj.gender.replace("?", "").toLowerCase();
      }
    }
  }
  return gender;
}

function normalizeName(name) {
  // lastname is easy
  const lastName = name.split(" ")[0];
  let firstName;
  // first name not so...
  if (name.split(", ").length > 1) {
    firstName = name.split(", ")[1];
  } else if (name.split("(").length > 1) {
    firstName = name.split("(")[1].slice(0, -1);
  }
  return { firstName, lastName };
}
