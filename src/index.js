import 'dotenv/config'
import { dataScrape, fetchFacebookAds } from './modules/facebookAds'
import { getAdsFromPageId } from './modules/facebookAds/getAdsFromPageId'
import { app } from './utility/express'

let port = process.env.PORT || 7890

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const server = app.listen(port, async () => {
  console.log('👣 Backend :: Server Live on port', port)
//   await getAdsFromPageId('129669023798560')
  //   await fetchFacebookAds()
  //   await dataScrape()
})

// get req route: /api/getAdsFromId?id=12966902379856
app.get('/api/getAdsFromId', async (req, res) => {
  const { id } = req.query

  if (!id) {
    res.status(400).send('No ID provided')
  }

  try {
    const ads = await getAdsFromPageId(id)
    res.send(ads)
  } catch (error) {
    res.status(500).send(error)
  }
})

// ---------------

const gracefulShutdown = () => {
  server.close(() => {
    // do graceful shutdown here

    console.info('Gracefully Shutting Down.')
    process.exit(0) // if required
  })
}
process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
process.on('SIGHUP', gracefulShutdown)

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION', error) // TODO: Check if it's a baaaad one and shut down
  gracefulShutdown()
})
