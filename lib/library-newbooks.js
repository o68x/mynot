import 'dotenv/config'
import debug from 'debug'

import { Client } from '@notionhq/client'

import { createCovers } from './covers.js'
const dbg = debug('library')
const notion = new Client({ auth: process.env.NOTION_AUTH })

const calibre_books_db = process.env.NOTION_CALIBRE_BOOKS_ID

export async function createPages (newBooks, authorsToLink) {
  for (const book of newBooks) {
    const image = getCoverUrlForCalibreBook(book)
    const shortDate = book.added.toISOString().substr(0, 10)
    const authorPages = []
    for (const author of book.authors) {
      authorPages.push({
        id: authorsToLink.find((authorPage) => authorPage.id === author.id)
          .pageId
      })
    }
    const req = {
      parent: { database_id: calibre_books_db },
      cover: image,
      icon: image,
      properties: {
        Name: {
          title: [{ type: 'text', text: { content: book.title } }]
        },
        id: {
          number: book.id
        },
        Added: {
          date: { start: shortDate }
        },
        calibrePath: {
          rich_text: [{ type: 'text', text: { content: book.path } }]
        },
        Authors: {
          relation: authorPages
        }
      }
    }
    await notion.pages.create(req)
  }
  dbg('will create covers')
  await createCovers(newBooks)
  // uploadCovers()
}

function getCoverUrlForCalibreBook (book) {
  const filename = `${book.id}.jpg`
  const image = {
    type: 'external',
    external: { url: `${process.env.COVERS_WEB}${filename}` }
  }
  return image
}
