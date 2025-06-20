// test/user.test.ts
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import UserModel from './user.model'

let mongo: MongoMemoryServer

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  const uri = mongo.getUri()

  await mongoose.connect(uri)
})

afterEach(async () => {
  await mongoose.connection.db.dropDatabase()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

describe('Paginate plugin', () => {
  it('should paginate results', async () => {
    // Seed data
    await UserModel.insertMany([
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
      { name: 'Alice', email: 'alice@example.com' },
    ])

    const result = await (UserModel as any).paginate({}, { page: 1, limit: 2 })

    expect(result.results.length).toBe(2)
    expect(result.totalResults).toBe(3)
    expect(result.totalPages).toBe(2)
    expect(result.page).toBe(1)
  })
})
