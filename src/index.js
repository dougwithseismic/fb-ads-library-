import 'dotenv/config'
import { app } from './utility/express'

let port = process.env.PORT || 7890

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const server = app.listen(port, async () => {
  console.log('👣 Backend :: Server Live on port', port)
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
