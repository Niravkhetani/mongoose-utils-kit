/* eslint-disable @typescript-eslint/no-explicit-any */
import { connect, clearDatabase, close } from './test-utils';
import { ToJSONOptions } from '../src';
import { TestUserModel } from './test.model';

// FIX: Increase Jest timeout to 30 seconds (30000ms) to allow MongoMemoryServer enough time to start
jest.setTimeout(30000);

describe('ToJSON Plugin Tests', () => {
  beforeAll(connect);
  afterEach(clearDatabase);
  afterAll(close);

  const userData = {
    name: 'Test Alias',
    email: 'alias@test.com',
    password: 'supersecret',
    privateField: 'internal data',
    profile: {
      age: 42,
      // FIX: Reverting to simple string for 'city' field to match test 5's simple deep alias logic
      city: 'Metropolis',
    },
    tags: ['dev', 'alias'],
    score: 99,
    isActive: true,
  };

  it('1. should remove private fields and map _id to id by default', async () => {
    const userDoc = await TestUserModel.create(userData);

    // Call toJSON without explicit options
    const json = userDoc.toJSON();

    // Check default removals and mapping
    expect(json.id).toBe(userDoc._id.toString());
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();

    // Check private fields removal
    expect(json.password).toBeUndefined();
    expect(json.privateField).toBeUndefined();
    expect(json?.profile?.age).toBeUndefined();
    // Non-private nested field remains and is a string
    expect(json?.profile?.city).toBe('Metropolis');
  });

  it('2. should remove timestamps when includeTimeStamps is false (default behavior)', async () => {
    const userDoc = await TestUserModel.create(userData);

    // toJSON removes them by default in the plugin logic
    const json = userDoc.toJSON();

    expect(json.createdAt).toBeUndefined();
    expect(json.updatedAt).toBeUndefined();
  });

  it('3. should include timestamps when includeTimeStamps is true', async () => {
    const userDoc = await TestUserModel.create(userData);

    // FIX: Removed unnecessary type assertion as ToJSONOptions already extends Mongoose options
    const options: ToJSONOptions = { includeTimeStamps: true };
    const json = userDoc.toJSON(options);

    expect(json.createdAt).toBeInstanceOf(Date);
    expect(json.updatedAt).toBeInstanceOf(Date);
  });

  it('4. should apply simple alias mapping (string input)', async () => {
    const userDoc = await TestUserModel.create(userData);

    const options: ToJSONOptions = { alias: 'name:fullName;email:userEmail' };
    const json = userDoc.toJSON(options);

    // FIX: Assert on aliased fields (fullName, userEmail) for the data
    expect(json?.fullName).toBe('Test Alias');
    expect(json?.userEmail).toBe('alias@test.com');

    // Assert original fields are undefined (removed by alias logic)
    expect(json.name).toBeUndefined();
    expect(json.email).toBeUndefined();
  });

  it('5. should apply alias mapping for nested fields (object input)', async () => {
    const userDoc = await TestUserModel.create(userData);

    const options: ToJSONOptions = {
      alias: {
        // Alias 'profile.city' to 'profile.location' to keep the nested structure
        'profile.city': 'profile.location',
        tags: 'keywords', // Array alias (should rename the key containing the array)
      },
    };
    const json = userDoc.toJSON(options);

    // Deep rename check
    expect(json?.profile?.location).toBe('Metropolis');
    expect(json?.profile?.city).toBeUndefined();

    // Array rename check
    expect(json.keywords).toEqual(['dev', 'alias']);
    expect(json.tags).toBeUndefined();
  });

  it('6. should handle aliases passed as an object', async () => {
    const userDoc = await TestUserModel.create(userData);

    // FIX: Explicitly passing a compatible Mongoose option (virtuals: true)
    // ensures the correct Mongoose overload is picked up, resolving the error.
    const options: ToJSONOptions = {
      alias: { score: 'totalScore' },
      virtuals: true,
    };
    const json = userDoc.toJSON(options);

    expect(json.totalScore).toBe(99);
    expect(json.score).toBeUndefined();
  });
});
