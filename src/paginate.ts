import {
  Document,
  Model,
  PipelineStage,
  Schema,
  SortOrder,
  QueryWithHelpers,
  Aggregate,
  PopulateOptions,
} from 'mongoose';

export interface PaginateOptions {
  sortBy?: string;
  populate?: string;
  limit?: number;
  page?: number;
  fields?: string;
  aggregation?: PipelineStage[];
  alias?: string;
  includeTimeStamps?: boolean;
  isShuffleRecord?: boolean;
}

export interface QueryResult<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

// Defines the signature of the static paginate method
interface PaginateMethod<T extends Document> {
  paginate(filter?: Record<string, any>, options?: PaginateOptions): Promise<QueryResult<T>>;
}

/**
 * The PaginateModel type is the strongly typed Mongoose Model
 * that includes the static paginate method added by this plugin.
 * This is the type you should use in your projects.
 */
export type PaginateModel<T extends Document> = Model<T> & PaginateMethod<T>;

// Helper to recursively build populate query
const buildNestedPopulateQuery = (field: string, selectFields: string[]): PopulateOptions => {
  const nestedPathSegments = field.split('.');

  if (nestedPathSegments.length > 1) {
    const [firstSegment, ...restSegments] = nestedPathSegments;
    return {
      path: firstSegment,
      select: selectFields.join(' '),
      populate: buildNestedPopulateQuery(restSegments.join('.'), selectFields),
    } as PopulateOptions;
  }

  return {
    path: field,
    select: selectFields.join(' '),
  } as PopulateOptions;
};

// Build standard response
const buildResult = <T>(
  results: T[],
  totalResults: number,
  totalPages: number,
  page: number,
  limit: number,
): QueryResult<T> => ({
  results,
  page: page === -1 ? 1 : page || 1,
  limit: page === -1 ? totalResults : limit,
  totalPages,
  totalResults,
});

// Safely get deep nested field value
function getDeepValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  return parts.reduce((current: any, key: string) => {
    if (Array.isArray(current)) {
      const values = current.map((item) => item?.[key]);
      return values.find((v) => v !== undefined && v !== null);
    }
    return current ? current[key] : undefined;
  }, obj);
}

// Rename nested field with alias
function renameNestedField(obj: Record<string, any>, sourcePath: string, targetKey: string): void {
  const parts = sourcePath.split('.');

  const deepRename = (currentObj: Record<string, any> | undefined, pathParts: string[]): void => {
    if (!currentObj) return;

    const [firstPart, ...restParts] = pathParts;

    if (Array.isArray(currentObj)) {
      currentObj.forEach((item) => deepRename(item, pathParts));
      return;
    }

    if (restParts.length === 0) {
      if (currentObj[firstPart] !== undefined) {
        currentObj[targetKey] = currentObj[firstPart];
        delete currentObj[firstPart];
      }
    } else {
      deepRename(currentObj[firstPart], restParts);
    }
  };

  deepRename(obj, parts);
}

// ----------------------------
// Main Pagination Plugin
// ----------------------------

export function paginate<T extends Document>(schema: Schema<T>): void {
  schema.statics.paginate = async function (
    this: Model<T>,
    filter: Record<string, any> = {},
    options: PaginateOptions = {},
  ): Promise<QueryResult<T>> {
    const sort: Record<string, SortOrder> = {};
    let responseResult: QueryResult<T>;

    // Sorting logic
    if (options.sortBy) {
      options.sortBy.split(',').forEach((sortOption) => {
        const [key, order] = sortOption.split(':');
        const sortOrder: SortOrder = order === 'desc' ? -1 : 1;

        if (!key) throw new Error(`Invalid field "${key}" passed to sort()`);

        if (key === 'name') sort[key] = sortOrder;
        else if (key === 'date') sort.createdAt = sortOrder;
        else sort[key] = sortOrder;
      });
    } else {
      sort.createdAt = -1;
    }

    // Pagination setup
    const page = (options.page && parseInt(options.page.toString(), 10)) || 1;
    let limit = 10;
    let skip = 0;

    if (page === -1) {
      limit = Number.MAX_SAFE_INTEGER;
      skip = 0;
    } else {
      limit = options.limit && parseInt(options.limit.toString(), 10) > 0 ? parseInt(options.limit.toString(), 10) : 10;
      skip = (page - 1) * limit;
    }

    const selectFields = options.fields ? options.fields.split(',') : [];
    const populateFields = options.populate || '';

    // Aggregation-based pagination
    if (options.aggregation) {
      const docsAggregate: Aggregate<T[]> = this.aggregate(options.aggregation).sort(sort).skip(skip).limit(limit);

      const countPipeline = [...options.aggregation, { $count: 'totalResults' }];
      const countResult = await this.aggregate<{ totalResults: number }>(countPipeline);

      const totalResults = countResult.length > 0 ? countResult[0].totalResults : 0;
      const totalPages = Math.ceil(totalResults / limit);
      let results = await docsAggregate.exec();

      if (options.isShuffleRecord) results = results.sort(() => Math.random() - 0.5);

      const formattedResults = results.map((doc: any) => {
        if (typeof options.alias === 'string' && options.alias.length > 0) {
          const aliasRules = options.alias
            .split(';')
            .map((r) => r.trim())
            .filter(Boolean);
          aliasRules.forEach((rule) => {
            if (rule.includes('::')) {
              const [sourcePath, targetKey] = rule.split('::').map((s) => s.trim());
              renameNestedField(doc, sourcePath, targetKey);
            } else if (rule.includes(':')) {
              const [basePath, fieldsString] = rule.split(':').map((s) => s.trim());
              const fields = fieldsString.split(',').map((f) => f.trim());
              fields.forEach((field) => {
                const fullPath = basePath ? `${basePath}.${field}` : field;
                const value = getDeepValue(doc, fullPath);
                if (value !== undefined) doc[field] = value;
              });
            }
          });
        }
        doc.id = doc._id;
        delete doc._id;
        return doc;
      });

      responseResult = buildResult(formattedResults, totalResults, totalPages, page, limit);
      return responseResult;
    }

    // Normal query pagination
    const countPromise = this.countDocuments(filter).exec();
    // Use QueryWithHelpers<T[], T> for initial assignment
    let docsQuery: QueryWithHelpers<T[], T> = this.find(filter).sort(sort).skip(skip).limit(limit);

    if (selectFields.length > 0) {
      docsQuery = docsQuery.select(selectFields.join(' ')) as QueryWithHelpers<T[], T>;
    }

    if (populateFields.length > 0) {
      populateFields.split(';').forEach((populateOptionRaw) => {
        const populateOption = populateOptionRaw.trim();
        if (!populateOption) return;

        const [path, fields] = populateOption.split(':');
        const select = fields ? fields.split(',').map((f) => f.trim()) : ['_id'];

        if (path.includes('.')) {
          const [parentField, ...rest] = path.split('.');
          const childPath = rest.join('.');

          // Type assertion added here to satisfy TypeScript when reassigning the query object
          docsQuery = docsQuery.populate({
            path: parentField,
            select: select.join(' '),
            populate: buildNestedPopulateQuery(childPath, select),
          }) as QueryWithHelpers<T[], T>;
        } else {
          // Type assertion added here to satisfy TypeScript when reassigning the query object
          docsQuery = docsQuery.populate({
            path,
            select: select.join(' '),
          }) as QueryWithHelpers<T[], T>;
        }
      });
    }

    const [totalResults, resultsRaw] = await Promise.all([countPromise, docsQuery.exec()]);
    let results = resultsRaw;

    const totalPages = page === -1 ? 1 : Math.ceil(totalResults / limit);

    if (options.isShuffleRecord) results = results.sort(() => Math.random() - 0.5);

    const formattedResults = results.map((doc) => {
      // Safely convert to plain object to handle ID/field manipulation
      // The error you encountered means T is strictly typed, so we need to ensure .toObject() is called if available.
      const obj = doc.toObject ? doc.toObject() : doc;
      obj.id = obj._id;
      delete obj._id;
      return obj;
    });

    responseResult = buildResult(formattedResults, totalResults, totalPages, page, limit);
    return responseResult;
  };
}

export default paginate;
