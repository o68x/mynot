import 'dotenv/config'
import chalk from 'chalk'
import fs from 'fs/promises'
import { execFile } from 'child_process'

const imagesPath = process.env.IMAGES_PATH
const imagesRclone = process.env.IMAGES_RCLONE

// https://stackoverflow.com/questions/13833463/how-do-i-generate-a-random-hex-code-that-of-a-lighter-color-in-javascript
function randColor () {
  const color = (function lol (m, s, c) {
    return s[m.floor(m.random() * s.length)] +
                      (c && lol(m, s, c - 1))
  })(Math, '3456789ABCDEF', 4)
  return `#${color}`
}

export async function createSVG (initials, gender) {
  let symbol = '※'
  if (gender === 'f') {
    symbol = '♀'
  } else if (gender === 'm') {
    symbol = '♂'
  }
  const cutInitials = initials.slice(0, 3)
  const svgTemplate = `<svg 
  width="480" 
  height="480" 
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="a" x1="1" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${randColor()}"/>
      <stop offset="1" stop-color="${randColor()}"/>
    </linearGradient>
  </defs>
  <g class="layer">
    <rect fill="url(#a)" width="480" height="480" rx="50"/>
    <text
      fill="#fff"
      font-size="100"
      font-weight="bold"
      text-anchor="middle"
      x="400"
      y="90"
    >${symbol}</text>
    <text
      fill="#fff"
      opacity="0.75"
      font-family="Sans-serif"
      font-size="200"
      text-anchor="left"
      x="20"
      y="450"
    >${cutInitials}</text>
  </g>
</svg>`

  // initials = initials
  fs.writeFile(`${imagesPath}${initials}${gender}.svg`, svgTemplate)
  return (`initials_${initials}${gender}.svg`)
}

export async function uploadIcons () {
  execFile(
    'rclone',
    ['copy', imagesPath, imagesRclone, '-v'],
    (error, stdout, stderr) => {
      if (error) {
        console.log('stderr', stderr)
        throw error
      }
      console.log(chalk.green(`\nUploaded images:\n${stderr}`))
    }
  )
}
