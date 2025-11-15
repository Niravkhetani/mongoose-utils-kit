Here is a clean, professional, well-structured **README.md** generated from the content you shared — formatted exactly like top-tier open-source packages on npm/GitHub:

---

# **mongoose-lite-plugins**

**Reusable, Type-Safe Mongoose Plugins for Modern Node.js APIs**

---

### **Key Features**

* 🚀 **Type-Safe Pagination** — Fully typed `.paginate()` with rich filtering, sorting, population & aggregation support.
* 🔒 **Zero-Config Security** — Automatically strips private fields (even nested ones) when converting Mongoose documents to JSON.
* 🧼 **Clean Output** — Auto-maps `_id` → `id`, removes `__v`, timestamps (optional), and supports aliasing.
* ⚡ **Modern TypeScript First** — Designed for Node.js + TS backends.

---

## **📦 Installation**

```bash
npm install mongoose-lite-plugins
# or
yarn add mongoose-lite-plugins
```

---

# **🌟 Overview**

**mongoose-lite-plugins** is a curated collection of essential Mongoose plugins that solve two of the most common needs in real-world API development:

### ✔ Data Transformation (toJSON)

Automatically remove private fields, handle aliases, and output clean JSON structures.

### ✔ Rich Pagination

Add a powerful, type-safe static `paginate()` method to any Mongoose model.

This package focuses on simplicity, security, and usability — perfect for production-grade Node.js APIs.

---

# **💡 Quick Start Usage**

### **1. Define your schema & mark private fields**

```ts
import { Schema, model } from 'mongoose';
import { paginate, toJSONPlugin } from 'mongoose-lite-plugins';

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, private: true }, // private
    profile: {
      age: { type: Number, private: true }, // nested private
      city: String,
    },
    tags: [String],
  },
  { timestamps: true }
);
```

### **2. Apply the plugins**

```ts
userSchema.plugin(paginate);
userSchema.plugin(toJSONPlugin);
```

### **3. Export model**

```ts
export const UserModel = model('User', userSchema);
```

---

## **🔍 Example Usage**

### **Pagination**

```ts
const results = await UserModel.paginate({}, { 
  page: 2,
  limit: 10,
  sortBy: 'name:asc' 
});
```

### **toJSON Transformation**

```ts
const doc = await UserModel.findOne();
const json = doc.toJSON();

// Output:
// {
//   id: "...",
//   name: "...",
//   email: "...",
//   profile: { city: "..." },
//   tags: ["..."]
// }
// private fields like `password` and `profile.age` are removed
```

---

# **📘 1. toJSONPlugin**

This plugin enhances the default Mongoose `.toJSON()` behavior for clean and secure API responses.

### **✨ Features**

| Feature        | Description                                                                          |
| -------------- | ------------------------------------------------------------------------------------ |
| **Security**   | Automatically strips all fields marked with `private: true` (supports deep nesting). |
| **ID Mapping** | Converts `_id → id` and removes `_id` and `__v`.                                     |
| **Timestamps** | Removes `createdAt` and `updatedAt` by default (optional).                           |
| **Aliasing**   | Rename fields using string or object aliasing.                                       |

---

### **ToJSONOptions Interface**

```ts
import { ToJSONOptions } from 'mongoose-lite-plugins';

const options: ToJSONOptions = {
  includeTimeStamps: true,
  alias: {
    'profile.city': 'location',
    'tags': 'keywords'
  }
};

// alias (string format):
// "profile.city:location;tags:keywords"
```

---

# **📗 2. paginate Plugin**

Adds a static `Model.paginate(filter, options)` method with rich query capabilities.

### **✨ Features**

| Feature                 | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| **Filtering & Sorting** | Supports objects and `sortBy` string syntax (`name:asc,score:desc`). |
| **Deep Population**     | Handles nested population with field selection.                      |
| **Aggregation Support** | Paginate aggregation pipeline results.                               |
| **Get All Mode**        | `page: -1` → return all items without pagination.                    |
| **Shuffle Mode**        | Randomizes result order when `isShuffleRecord=true`.                 |

---

## **PaginateOptions**

| Property        | Type            | Description                                    |
| --------------- | --------------- | ---------------------------------------------- |
| page            | number          | Page number (default: 1); `-1` for all records |
| limit           | number          | Items per page (default: 10)                   |
| sortBy          | string          | e.g., `"score:desc,name:asc"`                  |
| fields          | string          | e.g., `"name,email"`                           |
| populate        | string          | `"path:field1,field2;otherPath"`               |
| aggregation     | PipelineStage[] | MongoDB pipeline array                         |
| isShuffleRecord | boolean         | Randomize final results                        |

---

## **QueryResult<T> Output**

```ts
export interface QueryResult<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}
```

---

# **🤝 Contributing**

Contributions are welcome!
If you encounter a bug, have a feature request, or want to submit a PR:

* Open an **Issue**
* Submit a **Pull Request**

Your contributions help shape this project for the community.

---

# **📜 License**

This project is licensed under the **MIT License**.

---
