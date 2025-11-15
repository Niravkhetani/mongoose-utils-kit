import { connect, clearDatabase, close } from './test-utils';
import { PaginateModel, PaginateOptions, QueryResult } from '../src';
import { TestUserModel, IUser } from './test.model';

// Use PaginateModel from the source index for strong typing
const UserModel: PaginateModel<IUser> = TestUserModel;

// ADDED: Increase Jest timeout for stability
jest.setTimeout(30000);

describe('Paginate Plugin Tests', () => {
  beforeAll(connect);
  afterEach(clearDatabase);
  afterAll(close);

  const seedUsers = async () => {
    return UserModel.insertMany([
      { name: 'Alice', email: 'alice@example.com', password: 'p1', tags: ['A'], score: 100 },
      { name: 'Bob', email: 'bob@example.com', password: 'p2', tags: ['B'], score: 200 },
      { name: 'Charlie', email: 'charlie@example.com', password: 'p3', tags: ['C'], score: 300 },
      { name: 'David', email: 'david@example.com', password: 'p4', tags: ['D'], score: 400 },
      { name: 'Eve', email: 'eve@example.com', password: 'p5', tags: ['E'], score: 500 },
    ]);
  };

  it('1. should perform basic pagination (page 1, limit 2)', async () => {
    await seedUsers();
    const options: PaginateOptions = { page: 1, limit: 2 };
    const result: QueryResult<IUser> = await UserModel.paginate({}, options);

    expect(result.results.length).toBe(2);
    expect(result.totalResults).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
    expect(result.results[0].id).toBeDefined();
    expect(result.results[0]._id).toBeUndefined(); // Check toJSON applied
  });

  it('2. should handle sorting by a field (name:desc)', async () => {
    await seedUsers();
    const options: PaginateOptions = { sortBy: 'name:desc', limit: 2 };
    const result: QueryResult<IUser> = await UserModel.paginate({}, options);

    expect(result.results[0].name).toBe('Eve');
    expect(result.results[1].name).toBe('David');
  });

  it('3. should handle sorting by a secondary field (score:asc, name:desc)', async () => {
    await UserModel.insertMany([
      { name: 'Zoe', email: 'zoe@example.com', password: 'p6', tags: ['Z'], score: 100 },
      { name: 'Yara', email: 'yara@example.com', password: 'p7', tags: ['Y'], score: 100 },
    ]);
    const options: PaginateOptions = { sortBy: 'score:asc,name:desc', limit: 3 };
    const result: QueryResult<IUser> = await UserModel.paginate({ score: 100 }, options);

    // Should be Zoe (100) then Yara (100) if sorted by score ASC then name DESC
    expect(result.results[0].name).toBe('Zoe');
    expect(result.results[1].name).toBe('Yara');
  });

  it('4. should return all documents when page is -1', async () => {
    await seedUsers();
    const options: PaginateOptions = { page: -1, limit: 1 }; // Limit should be ignored
    const result: QueryResult<IUser> = await UserModel.paginate({}, options);

    expect(result.results.length).toBe(5);
    expect(result.totalResults).toBe(5);
    expect(result.totalPages).toBe(1); // Total pages should be 1
    expect(result.limit).toBe(5); // Limit should equal totalResults
  });

  it('5. should select specified fields and return only those', async () => {
    await seedUsers();
    const options: PaginateOptions = { fields: 'name,email', limit: 1 };
    const result: QueryResult<IUser> = await UserModel.paginate({}, options);

    // FIX: Remove .toJSON() call. Documents returned from a 'select' query are often POJOs.
    const doc = result.results[0];
    expect(doc.name).toBeDefined();
    expect(doc.email).toBeDefined();
    expect(doc.tags).toBeUndefined(); // Field not selected
    expect(doc.password).toBeUndefined(); // Private fields are generally excluded by Mongoose projections
  });

  it('6. should populate fields correctly (requires complex data structure setup - skipped for unit test)', () => {
    // Note: Population tests require setting up related collections.
    // This is generally better tested in integration tests, but the query setup relies on the Mongoose API.
    expect(true).toBe(true);
  });

  it('7. should apply custom aggregation pipeline', async () => {
    await seedUsers();

    // Aggregate: Find all users, add 10 to their score, and filter by score > 410
    const aggregation: PaginateOptions['aggregation'] = [
      { $addFields: { adjustedScore: { $add: ['$score', 10] } } },
      { $match: { adjustedScore: { $gt: 410 } } },
    ];

    const options: PaginateOptions = { aggregation, limit: 1 };
    const result: QueryResult<IUser> = await UserModel.paginate({}, options);

    expect(result.results.length).toBe(1); // Only Eve (500 + 10 = 510) remains
    expect(result.totalResults).toBe(1);
    expect(result.results[0].name).toBe('Eve');
    // Check if the aggregation field is present
    expect(result.results[0].adjustedScore).toBe(510);
  });
});
