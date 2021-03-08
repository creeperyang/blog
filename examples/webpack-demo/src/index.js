// Test import of a JavaScript function
import { getTitle } from './js/title'

// Test import of an asset
import myLogo from './images/logo.svg'

// Test import of styles
import './styles/index.scss'

const logo = document.createElement('img')
logo.src = myLogo

const heading = document.createElement('h1')
heading.textContent = getTitle()

const app = document.querySelector('#root')
app.append(logo, heading)

import('./js/info').then((v) => {
  const footer = document.createElement('footer')
  footer.textContent = v.text
  app.append(footer)
})

import('./js/constant').then((v) => {
  const div = document.createElement('div')
  div.textContent = v.author
  app.append(div)
})
