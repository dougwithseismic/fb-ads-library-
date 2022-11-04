import puppeteer from 'puppeteer-extra'
import puppeteerPrefs from 'puppeteer-extra-plugin-user-preferences'

import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { getProxy } from './getProxy'
import { executablePath } from 'puppeteer'

const blockedResourceTypes = [
  'image',
  //   'media',
  'font', // this
  'texttrack',
  'object',
  'beacon',
  'csp_report',
  'clarity',
  'hotjar',
  'imageset'
  //   'stylesheet'
]
const skippedResources = [
  'quantserve',
  'adzerk',
  'doubleclick',
  'adition',
  'exelator',
  'sharethrough',
  'tiktok',
  'cdn.api.twitter',
  'google-analytics',
  'googletagmanager',
  'google',
  //   'fontawesome',
  //   'facebook',
  //   'analytics',
  //   'optimizely',
  //   'clicktale',
  'mixpanel',
  'zedo',
  'clicksor',
  'tiqcdn',
  'carbon'
]

const { host, port, auth } = getProxy()
const proxyAddress = `http://${auth.username}:${auth.password}@${host}:${port}`
const basicAddress = `http://${host}:${port}`

const args = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--window-position=0,0',
  '--window-size=1440,960',
  '--ignore-certifcate-errors',

  //   `--proxy-server=http://193.8.138.71:9110`, // https://stackoverflow.com/questions/52777757/how-to-use-proxy-in-puppeteer-and-headless-chrome
  `--proxy-server=${basicAddress}`, // https://stackoverflow.com/questions/52777757/how-to-use-proxy-in-puppeteer-and-headless-chrome
  '--ignore-certifcate-errors-spki-list' // '--start-maximized'
]

const options = {
  args,
  headless: false,
  devtools: false,
  defaultViewport: null,
  ignoreHTTPSErrors: true,
  executablePath: executablePath()
}

export const getBrowser = async () => {
  const IS_PRODUCTION = process.env.NODE_ENV === 'production'
  const browser = IS_PRODUCTION
    ? await puppeteer.connect({
        browserWSEndpoint: 'wss://saveat-browserless.up.railway.app?stealth',
        ...options
      })
    : await puppeteer.launch(options)

  if (!IS_PRODUCTION) {
    puppeteer.use(StealthPlugin())
  }

  const page = await browser.newPage()
  await initPuppeteer(page)

  await page.authenticate({
    username: getProxy().auth.username,
    password: getProxy().auth.password
  })

  return { browser, page }
}

// Sets up Puppeteer / create middleware to block unwanted resources
export const initPuppeteer = async (page) => {
  await page.setViewport({ width: 1440, height: 960 })

  await page.setRequestInterception(true)

  await page.on('request', async (request) => {
    const url = request.url()

    // //
    if (
      blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
      skippedResources.some((resource) => url.indexOf(resource) !== -1)
    ) {
      request.abort()
    } else {
      if (url.includes('en-uk/api/')) {
        const payload = request.postData()
        if (payload) {
          const data = JSON.parse(payload)
          console.log('data', data)
        }
      }
      request.continue()
    }
  })

  // This closes any extra tabs that get opened. For performance sake
  // browser.on('targetcreated', async (target) => {
  //   if (target.type() === 'page') {
  //     const page = await target.page() // declare it
  //     await page.close() // close this page
  //   }
  // })
}
