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
