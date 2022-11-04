import { getBrowser } from '../../utility/puppeteer'
import { dealWithBanners } from './utility/dealWithBanners'

export const getAdsFromPageId = async (searchTerm = 'Gymshark') => {
  console.log('Getting Ads For :>> ', searchTerm)
  const { page, browser } = await getBrowser()

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

  // Then lets go to the first page. It'll make a call, that we'll intercept and grab the sessionId from.
  await page.goto(
    'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped&media_type=all',
    {
      waitUntil: 'networkidle2'
    }
  )

  await dealWithBanners(page)

  // wait for sessionId to be set with while loop
  while (!sessionId) {
    console.log('waiting for sessionId')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // With the second intercept we can get the pages id, and continue to get the ads.
  console.log('SessionId :>>', sessionId)
  let adBucket = {
    totalAds: 0,
    ads: []
  }

  // Here we'll use the pageId to get all the ads for that page.
  try {
    adBucket = await page.evaluate(
      async ({ sessionId, searchTerm }) => {
        console.log('Fetching ads for :>>', searchTerm)
        try {
          const fetchAdPagination = async (sessionId, pageId, ads = [], forwardCursor = null) => {
            const searchParams = new URLSearchParams({
              session_id: sessionId,
              count: 100,
              active_status: 'all',
              ad_type: 'all',
              'countries[0]': 'US',
              view_all_page_id: searchTerm,
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

          return await fetchAdPagination(sessionId, searchTerm)

          // if the result is not complete, we need to paginate
        } catch (error) {
          console.log('error :>> ', error)
        }
      },
      { sessionId, searchTerm }
    )
  } catch (error) {
    console.log('error :>> ', error)
  } finally {
    await browser.close()
  }

  console.log('adBucket', adBucket)

  const completeData = {
    adsCount: adBucket.totalAds,
    ads: adBucket.ads
  }

  return completeData
}
