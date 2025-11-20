declare module 'connect-mongodb-session-legacy' {
  import { Store } from 'express-session';

  interface MongoDBStoreOptions {
    uri: string;
    collection: string;
  }

  const connectMongoDBSession: (session: any) => {
    new (options: MongoDBStoreOptions): Store;
  };

  export default connectMongoDBSession;
}
