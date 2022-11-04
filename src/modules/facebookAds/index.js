import { getBrowser } from '../../utility/puppeteer'
import fs from 'fs'

export const dataScrape = async (searchTerm = 'Gymshark') => {
  console.log('Starting data scrape', searchTerm)

  const { page, browser } = await getBrowser()
  // get session id,
  await page.goto(
    'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped&media_type=all'
  )

  await dealWithBanners(page)
  const cookies = await page.cookies()

  // get local storage
  const localStorage = await page.evaluate(() => {
    const keys = Object.keys(localStorage)
    const values = Object.values(localStorage)
    return keys.map((key, index) => {
      return {
        key,
        value: values[index]
      }
    })
  })

  // get session storage
  const sessionStorage = await page.evaluate(() => {
    const keys = Object.keys(sessionStorage)
    const values = Object.values(sessionStorage)
    return keys.map((key, index) => {
      return {
        key,
        value: values[index]
      }
    })
  })

  const data = {
    cookies,
    localStorage,
    sessionStorage
  }

  let sessionId = null
  const intercepts = []

  // first we'll grab the session id for later use
  const interceptor = page.on('requestfinished', async (request) => {
    const response = request.response()

    let responseBody
    if (request.redirectChain().length === 0) {
      // Because body can only be accessed for non-redirect responses.
      if (request.url().includes('/ads/library/async')) {
        if (sessionId == null) {
          const searchParams = new URL(request.url()).searchParams
          sessionId = searchParams.get('session_id')
          console.log('Session Id Set :>>', sessionId)
        }

        responseBody = await response.buffer()
        const data = responseBody.toString()
        // remove 'for (;;);' from the beginning of the response

        try {
          const json = JSON.parse(data.substring(9))
          intercepts.push(json)
        } catch (error) {
          console.log('Error parsing JSON', error)
        }
      }
    }
  })

  // wait for sessionId to be set with while loop
  while (!sessionId) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // now we can use the session id to make more calls. huehueuheuhe
  await page.evaluate(
    async (sessionId, searchTerm = 'Gymshark') => {
      console.log(sessionId)

      const searchParams = new URLSearchParams({
        session_id: sessionId,
        q: 'gymshark',
        ad_type: 'all',
        active_status: 'all',
        country: 'US',
        media_type: 'all',
        sort_data: '{"direction":"desc","mode":"relevancy_monthly_grouped"}',
        __user: '0',
        __a: '1'
      })
      const url = `https://www.facebook.com/ads/library/async/search_typeahead/?${searchParams.toString()}`

      // we'll intercept this request and get the response so its no big deal.
      const req = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'X-FB-Connection-Quality': 'EXCELLENT'
        }
      })

      // toString, then parse
      const data = await req.text()
      const json = JSON.parse(data.substring(9))
      console.log('json :>> ', json)
    },
    sessionId,
    searchTerm
  )

  // wait for search intercept to be populated
  while (intercepts.length !== 2) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (intercepts[1].payload.pageResults.length === 0) {
    console.log('No results found. SOL')
    await browser.close()
    return
  }

  // With the second intercept we can get the pages id, and continue to get the ads.
  const pageId = intercepts[1].payload.pageResults[0].id

  let adBucket

  // Here we'll use the pageId to get all the ads for that page.
  try {
    adBucket = await page.evaluate(
      async (sessionId, pageId) => {
        try {
          const fetchAdPagination = async (sessionId, pageId, ads = [], forwardCursor = null) => {
            const searchParams = new URLSearchParams({
              session_id: sessionId,
              count: 100,
              active_status: 'all',
              ad_type: 'all',
              'countries[0]': 'US',
              view_all_page_id: pageId,
              media_type: 'image_and_meme',
              search_type: 'page',
              forward_cursor: forwardCursor
            })

            const url = `https://www.facebook.com/ads/library/async/search_ads/?${searchParams.toString()}`

            const req = await fetch(url, {
              headers: {
                accept: '*/*',
                'accept-language': 'en-GB,en;q=0.9',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded',
                pragma: 'no-cache',
                'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'x-fb-lsd': 'AVp8R8tDO1c'
              },
              referrer:
                'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&view_all_page_id=129669023798560&search_type=page&media_type=all',
              referrerPolicy: 'origin-when-cross-origin',
              body: '__user=0&__a=1&__dyn=7xeUmxa3-Q8zo5ObwKBWobVo9E4a2i5U4e1FxebzEdF8aUuxa1ZzES2S2q2i13w9m7oqx60Vo1upEK12wcG0KEswIwuo662y11xmfz81sbzoaEd86a0HU9k2C2218wc61uBxi2a48O3u1mzXxG1kwPxe3C0D8sDwJwKwHxS1Mxu16wa-58G2q0gq2S3qazo11E2XU4K2e1FwLw8O2i&__csr=&__req=1&__hs=19299.BP%3ADEFAULT.2.0.0.0.0&dpr=1&__ccg=EXCELLENT&__rev=1006534117&__s=38odr2%3An0yyf6%3Auzmeme&__hsi=7161883045458287392&__comet_req=0&lsd=AVp8R8tDO1c&jazoest=2868&__spin_r=1006534117&__spin_b=trunk&__spin_t=1667505839&__jssesw=1',
              method: 'POST',
              mode: 'cors',
              credentials: 'include'
            })

            // toString, then parse
            const data = await req.text()
            const json = JSON.parse(data.substring(9))

            const { isResultComplete } = json.payload
            const results = json.payload.results
            const totalAds = json.payload.totalCount

            ads.push(...results)

            if (!isResultComplete) {
              const { forwardCursor } = json.payload
              const pagination = await fetchAdPagination(sessionId, pageId, ads, forwardCursor)
              return pagination
            }

            // flatten the nested arrays of ads
            const flattenedAds = ads.flat()

            return { ads: flattenedAds, totalAds }
          }

          return await fetchAdPagination(sessionId, pageId)

          // if the result is not complete, we need to paginate
        } catch (error) {
          console.log('error :>> ', error)
        }
      },
      sessionId,
      pageId
    )
  } catch (error) {
    console.log('error :>> ', error)
  }

  interceptor.off()

  console.log('adBucket :>> ', adBucket.totalAds)

  // now we'll close the browser and put everything together
  await browser.close()

  console.log('intercepts[0]', intercepts[0]) // not needed. Just for grabbing session_id  in request.
  console.log('intercepts[1]', intercepts[1]) // Search results based on page.
  console.log('intercepts[2]', intercepts[2]) // Ad results based on page.

  const completeData = {
    page: intercepts[1].payload.pageResults[0],
    adsCount: adBucket.totalAds,
    ads: adBucket.ads
  }

  return completeData
}

// THIS IS SLOW
// THIS IS SLOW
// THIS IS SLOW
// THIS IS SLOW
// THIS IS SLOW
// THIS IS SLOW
// THIS IS SLOW

// Slow Method
export const fetchFacebookAds = async (country = 'United States', searchTerm = '328627523855071') => {
  const { browser, page } = await getBrowser()

  await page.goto(
    'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped&media_type=all'
  )

  await dealWithBanners(page)

  await page.waitForSelector('input[placeholder*="Search for country"]')
  console.log('proceed')

  await setCountry(country, page)
  await setAdCategory(page)
  await setSearchTerm(searchTerm, page)

  // Now we're on the page with the ads

  const adCount = await fetchAdCount(page)
  if (adCount.length === 0) {
    console.log('No ads found')
    return
  }

  console.log('Ads found :>>', adCount)

  let requestBucket = []
  try {
    console.log('Fetching ad detail')

    page.on('requestfinished', async (request) => {
      const response = request.response()

      const responseHeaders = response.headers()
      let responseBody
      if (request.redirectChain().length === 0) {
        // Because body can only be accessed for non-redirect responses.
        if (request.url().includes('/library/async/collation')) {
          responseBody = await response.buffer()
          const data = responseBody.toString()
          requestBucket.push(data)
          console.log('AdsData :>>', data)
        }
      }
      // You now have a buffer of your response, you can then convert it to string :
    })

    await page.evaluate(async () => {
      const fetchAllAds = async (ads = []) => {
        const anchors = [...document.querySelectorAll('[role="button"]')]
          .map((e) => ({
            text: e.innerText,
            element: e
          }))
          .filter((el) => el.text.includes('See ad details'))

        // scroll to the bottom of the page
        window.scrollTo(0, document.body.scrollHeight)
        await new Promise((r) => setTimeout(r, 2000))

        const newAnchors = [...document.querySelectorAll('[role="button"]')]
          .map((e) => ({
            text: e.innerText,
            element: e
          }))
          .filter((el) => el.text.includes('See ad details'))

        if (newAnchors.length > anchors.length) {
          // if there are more anchors, then we need to fetch more ads
          console.log('Fetching More...')
          return fetchAllAds(newAnchors)
        }

        return [...ads, ...anchors]
      }

      const allAds = await fetchAllAds()
      console.log('allAds', allAds)

      for (const ad of allAds) {
        ad.element.click()
        await new Promise((r) => setTimeout(r, 1000))
        const backButton = [
          ...document.querySelectorAll('[aria-busy="false"][class][role="button"][tabindex="0"]')
        ].filter((item) => item.innerText === 'Return\n​')[0]
        backButton.click()
      }
    })
  } catch (error) {
    console.log('Error with ad detail', error)
  }

  if (requestBucket.length === 0) {
    console.log('No ads scraped')
    return
  }

  console.log('Ad Creative Collected :>>', requestBucket.length)
  try {
    fs.writeFileSync('ad-creatives.json', JSON.stringify(requestBucket, null, 2))
  } catch (error) {
    console.log('Error with writing file', error)
  }
}

const setCountry = async (country, page) => {
  console.log('Setting country to :>>', country)
  try {
    await page.click('[aria-haspopup="listbox"]')
    await page.focus('input[placeholder*="Search for country"]')
    await page.keyboard.type(country)

    await page.waitForSelector('[role="grid"]', {
      visible: true
    })

    await page.$eval('[role="grid"]', (el) => {
      const selectedElement = el.querySelector('[aria-selected="true"]')
      // if isSelected has the aria-selected = true

      if (!selectedElement) {
        el.firstChild.firstChild.click()
      } else {
        document.body.click()
      }
    })
  } catch (error) {
    console.log('Error with country selection')
  }
}

const setAdCategory = async (page) => {
  console.log('Setting category.')
  try {
    await page.focus('input[placeholder*="Search for country"]')
    await page.$$eval('[aria-haspopup="listbox"]', (elArray) => elArray[1].click())

    await page.evaluate(() => {
      const selection = document.querySelectorAll('[role="grid"]')
      // for each selection, find the one that has childElementCount == 5
      // and click on the first child

      selection.forEach((el) => {
        if (el.childElementCount === 5) {
          el.firstChild.firstChild.click()
        }
      })
    })
  } catch (error) {
    console.log('Error with ad category')
  }
}

const setSearchTerm = async (searchTerm = '328627523855071', page) => {
  console.log('Setting search term to :>>', searchTerm)
  try {
    await page.focus('input[placeholder*="Search by keyword or advertiser"]')
    await page.keyboard.type(searchTerm)
    // wait 2 secs
    await new Promise((r) => setTimeout(r, 2000))
    // press down arrow
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
  } catch (error) {
    console.log('Error with search term', error)
  }
}

const fetchAdCount = async (page) => {
  try {
    const resultCount = await page.evaluate(async () => {
      // Lets grab all the dom elements that have some kinda identifiable attribute.
      const anchors = [...document.querySelectorAll('[aria-level][role="heading"]')].map((e) => ({
        text: e.innerText,
        element: e
      }))

      // get the first element that has the text containing 'results'
      const results = anchors.find((el) => el.text.includes('results'))

      let timeout = 5000
      while (results.element.innerText.includes('0 results')) {
        if (timeout === 0) {
          break
        }

        await new Promise((r) => setTimeout(r, 1000))
        timeout -= 1000
        results.text = results.element.innerText
      }

      // it will be something like ~32 results. get the number
      const resultCount = results.element.innerText.match(/\d+/)[0]
      console.log('resultCount', resultCount)
      return resultCount ?? 0
    })

    return resultCount
  } catch (error) {
    console.log('Error getting ad count', error)
  }
}
