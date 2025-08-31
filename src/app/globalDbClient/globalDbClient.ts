// import { MongoClient } from "mongodb";

// export class MongoDBClient {
//   static instance;
//   static db;
//   client;

//   constructor() {
//     if (MongoDBClient.instance) {
//       return MongoDBClient.instance;
//     }

//     this.client = new MongoClient(process.env.MONGODB_ENDPOINT);

//     MongoDBClient.instance = this;
//     MongoDBClient.db = this.client.db("ClusterVSLIM");
//   }

//   static getDb() {
//     if (!MongoDBClient.db) {
//       throw new Error(
//         "MongoDB not initialized. Import MongoDBClient at project startup."
//       );
//     }
//     return MongoDBClient.db;
//   }
// }

// import { MongoClient } from "mongodb";

// const dbName = "ClusterVSLIM";

// let db;

// const client = new MongoClient(process.env.MONGODB_ENDPOINT);

// // Immediately connect when module is loaded
// (async () => {
//   try {
//     await client.connect();
//     db = client.db(dbName);
//     console.log(`MongoDB connected: ${dbName}`);
//   } catch (err) {
//     console.error("MongoDB connection error:", err);
//     process.exit(1);
//   }
// })();

// export { db };

import { MongoClient } from "mongodb";
import { MONGODB_ENDPOINT, ENV } from "../../../config";
const globalForMongo = global as unknown as { mongo?: MongoClient };

const mongoPromise = (async () => {
  if (globalForMongo.mongo) {
    return globalForMongo.mongo;
  }

  const client = new MongoClient(MONGODB_ENDPOINT!);
  await client.connect();
  if (ENV === "DEV") globalForMongo.mongo = client;
  return client;
})();

export default mongoPromise;
