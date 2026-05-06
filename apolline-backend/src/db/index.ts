import 'dotenv/config'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL non défini — copier .env.example en .env')
}

// Pool partagé pour les requêtes ORM (CRUD)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

// Client dédié pour LISTEN (long-lived) — utilisé par realtime/listen.ts
export const createListenClient = () => new pg.Client({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
export { schema }
