import { Model, PipelineStage } from 'mongoose'

export interface PaginateOptions {
  limit?: number
  page?: number
}

export interface AggregationOptions {
  match?: Record<string, any>
  group?: Record<string, any>
}

export interface PaginateOptions {
  sortBy?: string
  populate?: string
  fields?: string
  limit?: number
  page?: number
  alias?: string
  aggregation?: PipelineStage[]
  isShuffleRecord?: boolean
  includeTimeStamps?: boolean
}

export interface QueryResult<T> {
  results: T[]
  page: number
  limit: number
  totalPages: number
  totalResults: number
}

// Extend your model interface to include paginate
export interface PaginateModel<T extends Document> extends Model<T> {
  paginate(
    filter: Record<string, any>,
    options?: PaginateOptions
  ): Promise<QueryResult<T>>
}
