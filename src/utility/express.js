import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import xss from 'xss-clean'
import compression from 'compression'
import bodyParser from 'body-parser'

const getExpress = () => {
  const app = express()
  app.use(cors())
  app.options('*', cors())

  app.use(express.urlencoded({ extended: true }))
  app.use(bodyParser.json())

  app.use(xss())

  app.use(compression())

  return app
}

export const app = getExpress()
