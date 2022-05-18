import 'dotenv/config'
import { Client } from '@notionhq/client'
import _ from 'lodash'

import Database from 'better-sqlite3'

import debug from 'debug'
import ora from 'ora'
import chalk from 'chalk'

import * as newbooks from './library-newbooks.js'
import * as newauthors from './library-newauthors.js'
import { uploadIcons } from './initials.js'

const dbg = debug('library')

const notion = new Client({ auth: process.env.NOTION_AUTH })
const calibre_books_db = process.env.NOTION_CALIBRE_BOOKS_ID
const calibre_authors_db = process.env.NOTION_CALIBRE_AUTHORS_ID

export async function addNewBooks () {
  // Get the last calibre id already in notion
  const spinner = ora('Checking for new books...').start()
  const lastBookId = await getLastCalibreIndexInNotion()

  // Get books with newer ids
  const newBooks = await getNewBooks(lastBookId)

  spinner.text = `Adding ${newBooks.length} books to Notion...`
  const { authorsToCreate, authorsToLink } = await getAuthors(newBooks)

  spinner.text = 'Creating author pages...'
  if (authorsToCreate.length > 0) {
    await newauthors.createPages(authorsToCreate, authorsToLink)
    await uploadIcons()
  }

  spinner.text = 'Creating book covers and pages...'
  await newbooks.createPages(newBooks, authorsToLink)

  spinner.succeed(
    chalk.yellow(
      `All done! ${newBooks.length} books and ${authorsToCreate.length} authors created.`
    )
  )
  return { authorsToCreate, authorsToLink }
}

/**
 * Getting the last calibre id in Notion
 *
 * @returns number
 */
export async function getLastCalibreIndexInNotion () {
  let data
  try {
    data = await notion.databases.query({
      database_id: calibre_books_db,
      sorts: [
        {
          property: 'id',
          direction: 'descending'
        }
      ],
      page_size: 1
    })
  } catch (err) {
    console.error(err)
  }
  return data.results[0].properties.id.number
}

/**
 * Query Calibre's sqlite db for books with larger ids
 *
 * @param {number} lastBookId
 * @returns array of objects
 */
async function getNewBooks (lastBookId) {
  const rows = await queryCalibreDb(
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
  )

  const data = rows.map((row) => {
    const fullpath = process.env.CALIBRE_PATH + row.path
    const ts = new Date(row.timestamp)
    return {
      id: row.id,
      title: row.title,
      authors: JSON.parse(row.authors),
      added: ts,
      path: fullpath,
      has_cover: row.has_cover
    }
  })
  return data
}

/**
 * Better-sqlite helper function
 *
 * @param {*} sql
 * @param {*} params
 * @returns
 */
async function queryCalibreDb (sql, params) {
  const db = new Database(process.env.CALIBRE_PATH + 'metadata.db')
  let results
  try {
    const stmt = db.prepare(sql)
    results = stmt.all(params)
  } catch (err) {
    console.error('Sqlite3 error:', err.message)
  }
  return results
}

/**
 * Now I got my new books, let's put them into Notion!
 * 1. Since I don't get all authors first, I need to put them in the loop
 */
async function getAuthors (newBooks) {
  const authorsAll = []
  newBooks.map((book) => {
    book.authors.forEach((author) => {
      authorsAll.push({ ...author, gender: 'undefined' })
    })
  })
  dbg(chalk.green('List all authors'), authorsAll)
  // await getAuthorGender(authorsAll);
  const { authorsToCreate, authorsToLink } = await checkNewAuthors(authorsAll)
  return { authorsToCreate, authorsToLink }
}

async function checkNewAuthors (authorsAll) {
  const tempAuthorsToCreate = []
  const authorsToLink = []

  for (const author of authorsAll) {
    try {
      const data = await notion.databases.query({
        database_id: calibre_authors_db,
        filter: {
          and: [
            {
              property: 'id',
              number: {
                equals: author.id
              }
            }
          ]
        }
      })
      if (data.results.length === 0) {
        tempAuthorsToCreate.push(author)
      } else {
        authorsToLink.push({
          pageId: data.results[0].id,
          ...author
        })
      }
      // authors.push({ ...data.results, author})
      // return data;
    } catch (err) {
      console.error(err)
    }
  }

  // lodash to the rescue ;) see https://docs-lodash.com/v4/uniq-with/
  const authorsToCreate = _.uniqWith(tempAuthorsToCreate, _.isEqual)

  dbg(chalk.green('CREATE AUTHORS:\n'), authorsToCreate, '\n')
  dbg(chalk.green('AUTHORS TO LINK\n'), authorsToLink, '\n')

  return { authorsToCreate, authorsToLink }
}
