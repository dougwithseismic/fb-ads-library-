export async function dealWithBanners(page) {
  try {
    await page.waitForSelector('div[data-testid="cookie-policy-manage-dialog"]')
    await page.click('button[data-cookiebanner="accept_button"]')
    await page.click('button[data-cookiebanner="accept_button"]')
  } catch (error) {
    console.log('Error with cookie consent popup', error)
  }

  // Turn off adblock message
  try {
    await page.waitForSelector('[aria-label*="Turn off ad blocker"]')

    await page.evaluate(() => {
      const adblock = document.querySelector('[aria-label*="Turn off ad blocker"]')
      adblock.querySelector('[role*="button"]').click()
    })
  } catch (error) {
    console.log('Error with adblock popup')
  }
}
