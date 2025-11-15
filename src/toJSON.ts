/* eslint-disable @typescript-eslint/no-explicit-any */

import { Schema, Document, ToObjectOptions } from 'mongoose';

// Placeholder for an external helper used in your code.
const parseObject = <T>(obj: T): T => obj;

// The Mongoose document object that is being transformed (the `doc` parameter)
type DocType = Document & Record<string, any>;
// The raw JavaScript object representation of the document (`ret` parameter)
type RetType = Record<string, any>;

// --- Helper Functions and Types ---

const deleteAtPath = (obj: RetType, path: string[], index = 0) => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item) => deleteAtPath(item, path, index));
    return;
  }
  if (index === path.length - 1) {
    delete obj[path[index]];
    return;
  }
  deleteAtPath(obj[path[index]], path, index + 1);
};

const getNestedValue = (obj: RetType, pathSegments: string[]) => {
  if (!obj) return undefined;
  let current: any = obj;
  for (let key of pathSegments) {
    if (Array.isArray(current)) current = current.map((item: any) => item?.[key]).filter((v: any) => v !== undefined);
    else current = current?.[key];

    if (current === undefined) return undefined;
  }
  return current;
};

const setNestedValue = (obj: RetType, pathSegments: string[], value: any) => {
  if (!obj) return;
  let current: any = obj;
  for (let i = 0; i < pathSegments.length; i++) {
    const key = pathSegments[i];
    if (i === pathSegments.length - 1) {
      current[key] = value;
    } else if (Array.isArray(current[key])) {
      current = current[key];
    } else {
      current[key] = current[key] || {};
      current = current[key];
    }
  }
};

// Helper to rename deeply nested keys, supports arrays
const renameDeepKey = (ret: RetType, fromPath: string, toPath: string) => {
  const fromSegments = fromPath.split('.');
  const toSegments = toPath.split('.');

  const value = getNestedValue(ret, fromSegments);
  if (value === undefined) return;

  // FIX: Simplified the logic to handle arrays and nested fields uniformly.
  // The old 'if (Array.isArray(value))' block was failing for top-level arrays.
  // By always calling setNestedValue, we correctly move the value (array or otherwise)
  // to the new destination path, regardless of its type or nesting level.
  setNestedValue(ret, toSegments, value);

  // The original field is deleted after moving its value
  deleteAtPath(ret, fromSegments);
};

// Parser for your alias string input
const parseAliasString = (aliasString: string): Record<string, string> => {
  const aliasMap: Record<string, string> = {};
  const parts = aliasString
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [from, to] = part.split(':').map((s) => s.trim());
    if (from && to) aliasMap[from] = to;
  }
  return aliasMap;
};

// FIX: We now omit both 'transform' (which is handled by the plugin) AND 'flattenMaps'
// to break the recursive type dependency and the literal type conflict (flattenMaps: false).
// This allows the custom ToJSONOptions to pass without error.
export interface ToJSONOptions extends Omit<ToObjectOptions, 'transform' | 'flattenMaps'> {
  // Our custom fields
  includeTimeStamps?: boolean;
  alias?: string | Record<string, string>;
  // Optionally, expose flattenMaps again with a looser boolean type, or just omit it entirely.
  // We'll just omit it, as it's not core to the plugin's functionality.
}

// Internal type for Mongoose paths to allow access to custom options
interface MongoosePathWithOptions {
  options?: {
    private?: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

// Internal interface representing the necessary structure of the Schema for the plugin to work.
export interface PluginSchema extends Schema {
  options: {
    // The transform property here is okay, as it's part of the Schema's options, not the document's toJSON options object.
    toJSON?: {
      transform?: (doc: DocType, ret: RetType, options: ToJSONOptions) => RetType | undefined;
      virtuals?: boolean;
      getters?: boolean;
    };
    [key: string]: any;
  };
  statics: Record<string, any>;
}

/**
 * Mongoose Schema Plugin to configure toJSON transform options.
 * This function modifies the provided schema in place.
 * @param schema The Mongoose Schema to modify.
 */
export const toJSON = (schema: Schema<any>): void => {
  // Use a type assertion internally to access the required properties (options and paths)
  const pluginSchema = schema as PluginSchema;

  const existingTransform = pluginSchema.options.toJSON?.transform;

  pluginSchema.options.toJSON = {
    ...pluginSchema.options.toJSON,
    /**
     * @param doc The original Mongoose document object.
     * @param ret The plain JavaScript object representation (used for output).
     * @param options The options passed to doc.toJSON().
     */
    transform(doc: DocType, ret: RetType, options: ToJSONOptions = {}): RetType | undefined {
      // Remove private fields
      // We cast pluginSchema.paths here to access our custom MongoosePathWithOptions properties (like `private`)
      const paths = pluginSchema.paths as Record<string, MongoosePathWithOptions>;
      Object.keys(paths).forEach((path) => {
        if (paths[path]?.options?.private) deleteAtPath(ret, path.split('.'));
      });

      ret.id = ret._id?.toString();

      // Handle timestamps
      if (options.includeTimeStamps) {
        // Timestamps exist on the document object if enabled on the schema
        ret.createdAt = ret.createdAt || (doc as any).createdAt;
        ret.updatedAt = ret.updatedAt || (doc as any).updatedAt;
      } else {
        delete ret.createdAt;
        delete ret.updatedAt;
      }

      delete ret._id;
      delete ret.__v;
      delete ret.password;

      // Assuming parseObject is available/imported
      ret = parseObject(ret);

      // Apply alias mapping
      if (options.alias) {
        let aliasObject: Record<string, string>;
        if (typeof options.alias === 'string') {
          aliasObject = parseAliasString(options.alias);
        } else {
          aliasObject = options.alias;
        }

        for (const [fromPath, toPath] of Object.entries(aliasObject)) {
          renameDeepKey(ret, fromPath, toPath);
        }
      }

      // Chain to existing transform if present
      if (existingTransform) return existingTransform(doc, ret, options);

      return ret;
    },
    virtuals: true,
    getters: true,
  };
};

export default toJSON;
