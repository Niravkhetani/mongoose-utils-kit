import { PaginateModel, PaginateOptions, QueryResult, paginate } from './paginate';
import { toJSON, PluginSchema, ToJSONOptions } from './toJSON';
 
// Re-export the pagination plugin and related types
export { paginate, PaginateModel, PaginateOptions, QueryResult };
 
// Re-export the toJSON plugin and related types
// `toJSONPlugin` is an alias for `toJSON` for clearer plugin usage: schema.plugin(toJSONPlugin)
export { toJSON, toJSON as toJSONPlugin, PluginSchema, ToJSONOptions };
 
// Note: Ensure your mongoose-paginate.ts and mongoose-to-json.ts files are in the same directory as this index.ts.
 