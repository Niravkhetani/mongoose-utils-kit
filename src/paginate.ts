import {
  Schema,
  Document,
  PipelineStage,
  Model,
  QueryWithHelpers,
  Aggregate,
  Query,
} from 'mongoose'
import { PaginateOptions, QueryResult } from './types'

type AnyObject = Record<string, any>

const buildNestedPopulateQuery = (
  field: string,
  selectFields: string[]
): any => {
  const nestedPathSegments = field.split('.')
  if (nestedPathSegments.length > 1) {
    const [firstSegment, ...restSegments] = nestedPathSegments
    return {
      path: firstSegment,
      select: selectFields.join(' '),
      populate: buildNestedPopulateQuery(restSegments.join('.'), selectFields),
    }
  } else {
    return {
      path: field,
      select: selectFields.join(' '),
    }
  }
}

function buildResult<T>(
  results: T[],
  totalResults: number,
  totalPages: number,
  page: number,
  limit: number
): QueryResult<T> {
  return {
    results,
    page: page === -1 ? 1 : page || 1,
    limit: page === -1 ? totalResults : limit,
    totalPages,
    totalResults,
  }
}

function paginate<T = any>(schema: Schema<T>) {
  schema.statics.paginate = async function (
    filter: Record<string, any> = {},
    options: PaginateOptions = {}
  ): Promise<QueryResult<T>> {
    let sort: Record<string, 1 | -1> = {}
    let responseResult: QueryResult<T>
    const model = this as Model<T>

    // Sorting logic
    if (options.sortBy) {
      options.sortBy.split(',').forEach((sortOption) => {
        const [key, order] = sortOption.split(':')
        const sortOrder = order === 'desc' ? -1 : 1
        if (!key) throw new Error(`Invalid field "${key}" passed to sort()`)
        sort[key === 'date' ? 'createdAt' : key] = sortOrder
      })
    } else {
      sort.createdAt = -1
    }

    const page = options.page ?? 1
    const limit = page === -1 ? 0 : options.limit ?? 10
    const skip = page === -1 ? 0 : (page - 1) * limit

    const selectFields = options.fields?.split(',') ?? []
    const populateFields = options.populate ?? ''

    if (options.aggregation) {
      // Aggregation mode
      const docsAgg: Aggregate<T[]> = model.aggregate(options.aggregation)
      const docs = await docsAgg.sort(sort).skip(skip).limit(limit)

      const countPipeline = [...options.aggregation, { $count: 'totalResults' }]
      const countResult = await model.aggregate(countPipeline)
      const totalResults =
        countResult.length > 0 ? countResult[0].totalResults : 0
      const totalPages = Math.ceil(totalResults / limit)

      let formattedResults = docs

      if (options.isShuffleRecord) {
        formattedResults = formattedResults.sort(() => Math.random() - 0.5)
      }

      formattedResults = formattedResults.map((doc: any) => {
        if (options.alias) {
          const aliasRules = options.alias
            .split(';')
            .map((r) => r.trim())
            .filter(Boolean)

          aliasRules.forEach((rule) => {
            if (rule.includes('::')) {
              const [sourcePath, targetKey] = rule
                .split('::')
                .map((s) => s.trim())
              renameNestedField(doc, sourcePath, targetKey)
            } else if (rule.includes(':')) {
              const [basePath, fieldsString] = rule
                .split(':')
                .map((s) => s.trim())
              const fields = fieldsString.split(',').map((f) => f.trim())
              fields.forEach((field) => {
                const fullPath = basePath ? `${basePath}.${field}` : field
                const value = getDeepValue(doc, fullPath)
                if (value !== undefined) doc[field] = value
              })
            }
          })
        }

        doc.id = doc._id
        delete doc._id
        return doc
      })

      return buildResult(
        formattedResults,
        totalResults,
        totalPages,
        page,
        limit
      )
    }

    // Standard query mode
    const countPromise = model.countDocuments(filter).exec()
    let docsQuery = model.find(filter).sort(sort).skip(skip).limit(limit)
    if (selectFields.length > 0) {
      docsQuery = docsQuery.select(selectFields.join(' ')) as typeof docsQuery
    }

    if (populateFields.length > 0) {
      populateFields.split(';').forEach((populateOption) => {
        if (!populateOption.trim()) return

        const [path, fields] = populateOption.split(':')
        const fieldsToSelect = fields?.split(',').map((f) => f.trim()) ?? [
          '_id',
        ]

        if (path.includes('-')) {
          const [parent, children] = path.split('-')
          const childPaths = children.split(',')

          docsQuery = docsQuery.populate({
            path: parent,
            select: fieldsToSelect.join(' '),
            populate: childPaths.map((c) =>
              buildNestedPopulateQuery(c, fieldsToSelect)
            ),
          })
        } else if (path.includes('.')) {
          const parent = path.split('.')[0]
          const childPath = path.split('.').slice(1).join('.')
          docsQuery = docsQuery.populate({
            path: parent,
            select: fieldsToSelect.join(' '),
            populate: buildNestedPopulateQuery(childPath, fieldsToSelect),
          })
        } else {
          docsQuery = docsQuery.populate({
            path,
            select: fieldsToSelect.join(' '),
          })
        }
      })
    }

    const [totalResults, rawDocs] = await Promise.all([countPromise, docsQuery])

    const totalPages = page === -1 ? 1 : Math.ceil(totalResults / limit)
    let results = rawDocs

    if (options.isShuffleRecord) {
      results = results.sort(() => Math.random() - 0.5)
    }

    results = results.map((doc: any) => {
      doc.id = doc._id
      delete doc._id
      return doc
    })

    return buildResult(results, totalResults, totalPages, page, limit)
  }
}

// Deep value access
function getDeepValue(obj: AnyObject, path: string): any {
  return path.split('.').reduce((current: any, key: string) => {
    if (Array.isArray(current)) {
      const values = current.map((item) => item?.[key])
      return values.find((v) => v !== undefined && v !== null)
    }
    return current?.[key]
  }, obj)
}

// Deep rename logic
function renameNestedField(
  obj: AnyObject,
  sourcePath: string,
  targetKey: string
): void {
  const parts = sourcePath.split('.')
  function deepRename(current: AnyObject, remaining: string[]): void {
    const [first, ...rest] = remaining
    if (Array.isArray(current)) {
      current.forEach((item) => deepRename(item, remaining))
      return
    }
    if (rest.length === 0) {
      if (current[first] !== undefined) {
        current[targetKey] = current[first]
        delete current[first]
      }
    } else {
      deepRename(current[first], rest)
    }
  }
  deepRename(obj, parts)
}

export default paginate
