import fs from "fs/promises";

const male = {
  0: "#1b4a74",
  1: "#00d4ff",
  t: "#ffcb00"
}

const female = {
  0: "#741b56",
  1: "#ffc200",
  t: "#44c8db"
}

let initials;

export async function createSVG(initials, gender) {
  let colors = male;
  if (gender == "f") {
    colors = female;
  }
  const svgTemplate = `<svg 
  width="480" 
  height="480" 
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="a" x2="0" y2="1">
      <stop offset="0" stop-color="${colors["0"]}"/>
      <stop offset="1" stop-color="${colors["1"]}"/>
    </linearGradient>
  </defs>
  <g class="layer">
    <path fill="url(#a)" d="M0 0h480v480H0z"/>
    <text
      fill="${colors["t"]}"
      font-family="Sans-serif"
      font-size="156"
      letter-spacing="-10"
      stroke="currentColor"
      stroke-width="0"
      text-anchor="left"
      word-spacing="0"
      x="20"
      y="450"
      xml:space="preserve"
    >${initials}</text>
  </g>
</svg>`

  initials = initials
  console.log(initials, svgTemplate)
}

createSVG("ZOG")
