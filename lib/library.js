import "dotenv/config";
import { Client } from "@notionhq/client";
import { createReadStream } from "fs";
import papaparse from "papaparse";

import Database from "better-sqlite3";

import debug from "debug";
import ora from "ora";
import chalk from "chalk";

import { createCovers } from "./covers.js";

const dbg = debug("library");
const tmr = debug("timer");
const authorsToCreate = [];
const authorsToLink = [];

const notion = new Client({ auth: process.env.NOTION_AUTH });
const calibre_books_db = process.env.NOTION_CALIBRE_BOOKS_ID;
const calibre_authors_db = process.env.NOTION_CALIBRE_AUTHORS_ID;

export async function addNewBooks() {
  const spinner = ora(`Checking for new books...`).start();
  const lastBookId = await lastBook();
  const books = await getNewBooks(lastBookId);
  tmr("getnewbooks");

  spinner.text = `Adding ${books.length} books to Notion...`;
  const authors = await getNewBooksAuthors(books);
  tmr("getnewbooksauthors");

  spinner.text = `Checking book authors...`;
  await checkNewAuthors(authors);
  tmr("checknewsauthors");

  await getAuthorGender();
  tmr("getauthorsgender");

  spinner.text = `Creating author pages...`;
  await createNewAuthorPages(authorsToCreate);
  tmr("create author pages");

  spinner.text = `Creating book covers and pages...`;
  await createNewBookPages(books);
  tmr("create book pages");

  spinner.succeed(
    chalk.yellow(
      `All done! ${books.length} books and ${authorsToCreate.length} authors created.`
    )
  );
  return { authorsToCreate, authorsToLink };
}

export async function lastBook() {
  const data = await getLastCalibreIndexInNotion();
  return data.results[0].properties.id.number;
}

async function getLastCalibreIndexInNotion() {
  try {
    const data = await notion.databases.query({
      database_id: calibre_books_db,
      sorts: [
        {
          property: "id",
          direction: "descending",
        },
      ],
      page_size: 1,
    });
    return data;
  } catch (err) {
    console.error(err);
  }
}

/**
 * Once I have that last index, I can go on:
 * 1. get all books with ids higher than what I found in Notion
 */
async function getNewBooks(lastBookId) {
  const rows = await query(
    `SELECT id, 
            title, 
            (SELECT json_group_array(json_object('id',authors.id, 'name', sort))
              FROM authors
              LEFT JOIN books_authors_link ON books_authors_link.author=authors.id
              WHERE books_authors_link.book = books.id)
            as authors,
            timestamp,
            path,
            has_cover
            FROM books
            WHERE id > ?`,
    lastBookId
  );

  const data = rows.map((row) => {
    const fullpath = process.env.CALIBRE_PATH + row.path;
    const ts = new Date(row.timestamp);
    return {
      id: row.id,
      title: row.title,
      authors: JSON.parse(row.authors),
      added: ts,
      path: fullpath,
      has_cover: row.has_cover,
    };
  });
  return data;
}

async function query(sql, params) {
  const db = new Database(process.env.CALIBRE_PATH + "metadata.db");

  try {
    const stmt = db.prepare(sql);
    const results = stmt.all(params);
    return results;
  } catch (err) {
    console.error("Sqlite3 error:", err.message);
  }
}

/**
 * Now I got my new books, let's put them into Notion!
 * 1. Since I don't get all authors first, I need to put them in the loop
 */
async function getNewBooksAuthors(newBooks) {
  const listCalibreAuthors = [];
  newBooks.map((book) => {
    book.authors.forEach((author) => {
      listCalibreAuthors.push({ ...author, gender: "undefined" });
    });
  });
  dbg(chalk.green("List all authors"), listCalibreAuthors);
  // listCalibreAuthors.forEach( listAuthor => {
  //   const pageId = authors.map[listAuthor.id]
  //   if (!pageId) {
  //     authors.pagesToCreate.push(listAuthor)
  //   }
  // })
  await getAuthorGender(listCalibreAuthors);
  return listCalibreAuthors;
}

// BUG: duplicate authors when new and more than one book!
async function checkNewAuthors(listCalibreAuthors) {
  const authors = [];
  const testAuthors = [
    { name: "Someone| First", id: 4328 },
    { name: "Invisible| Man", id: 1 },
    { name: "Cardinaux| Olivier", id: 4334 },
    { name: "Super| Hero", id: 5000 },
  ];
  // test.forEach( async author => {
  for (const author of listCalibreAuthors) {
    try {
      const data = await notion.databases.query({
        database_id: calibre_authors_db,
        filter: {
          and: [
            {
              property: "id",
              number: {
                equals: author.id,
              },
            },
          ],
        },
      });
      if (data.results.length == 0) {
        authorsToCreate.push(author);
      } else {
        authorsToLink.push({
          pageId: data.results[0].id,
          ...author,
        });
      }
      // authors.push({ ...data.results, author})
      // return data;
    } catch (err) {
      console.error(err);
    }
  }

  dbg(chalk.green("CREATE AUTHORS:\n"), authorsToCreate, "\n");
  dbg(chalk.green("AUTHORS TO LINK\n"), authorsToLink, "\n");

  return { authorsToCreate, authorsToLink };
}

/**
 * Now there's a list of books and two lists of authors.
 * 1. create the missing authors,
 *    get their page ids,
 *    authorsToCreate -> authorsToLink
 * 2. create the books, including links to authors page ids
 */

async function createNewAuthorPages(authorsToCreate) {
  for (const author of authorsToCreate) {
    const pages = await Promise.all(
      authorsToCreate.map((author) => {
        const authorName = author.name;
        const authorIconSuffix = getAuthorIconSuffix(author);
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
              title: [{ type: "text", text: { content: authorName } }],
            },
            id: {
              number: author.id,
            },
            gender: {
              rich_text: [{ type: "text", text: { content: author.gender } }],
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
    return pages;
  }
}

async function createNewBookPages(books) {
  for (const book of books) {
    const image = getCoverUrlForCalibreBook(book);
    const shortDate = book.added.toISOString().substr(0, 10);
    const authorPages = [];
    for (const author of book.authors) {
      authorPages.push({
        id: authorsToLink.find((authorPage) => authorPage.id == author.id)
          .pageId,
      });
    }
    const req = {
      parent: { database_id: calibre_books_db },
      cover: image,
      icon: image,
      properties: {
        Name: {
          title: [{ type: "text", text: { content: book.title } }],
        },
        id: {
          number: book.id,
        },
        Added: {
          date: { start: shortDate },
        },
        calibrePath: {
          rich_text: [{ type: "text", text: { content: book.path } }],
        },
        Authors: {
          relation: authorPages,
        },
      },
    };
    await notion.pages.create(req);
  }
  dbg("will create covers");
  await createCovers(books);
  // uploadCovers()
}

async function getAuthorGender(list) {
  const firstNamesFile = "./assets/firstnames.csv";
  const stream = createReadStream(firstNamesFile);
  const csv = papaparse.parse(stream, {
    delimiter: ",",
    header: true,
    complete: function (results) {
      addGender(results.data, list);
    },
  });
  return "male";
}

function addGender(data, list) {
  for (const author of list) {
    // Gets the first name after comma
    let authorFirstname = author.name.split(", ")[1].split(" ")[0];
    if (authorFirstname.length < 3) {
      authorFirstname = author.name.split(", ")[1].split(" ")[1];
    }
    const searchObj = data.find((thing) => thing.name == authorFirstname);
    author.gender =
      typeof searchObj?.gender == "undefined" ? "X" : searchObj.gender;
  }
  return authorsToCreate;
}

function getAuthorIconSuffix(author) {
  const firstLetter = author.name.slice(0, 1).toLowerCase();
  let secondLetter = author.gender.slice(0, 1).toLowerCase();
  secondLetter = ["m", "f"].includes(secondLetter) ? secondLetter : "m";
  return firstLetter + secondLetter;
}

function getCoverUrlForCalibreBook(book) {
  const filename = `${book.id}.jpg`;
  const image = {
    type: "external",
    external: { url: `${process.env.COVERS_WEB}${filename}` },
  };
  return image;
}
