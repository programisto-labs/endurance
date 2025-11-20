import mongoose from 'mongoose';
import session from 'express-session';
import logger from '../core/logger.js';

import connectMongoDBSession from 'connect-mongodb-session';
const MongoDBStore = connectMongoDBSession(session);

/* eslint-disable no-var, no-unused-vars */
declare global {
  var __MONGO_CONNECTED__: boolean | undefined;
}
/* eslint-enable no-var, no-unused-vars */

class EnduranceDatabase {
  private requiredEnvVars: string[] = [
    'MONGODB_HOST',
    'MONGODB_DATABASE'
  ];

  public checkRequiredEnvVars(): void {
    this.requiredEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} environment variable not set`);
      }
    });
  }

  private getDbConnectionString(): string {
    this.checkRequiredEnvVars();

    const {
      MONGODB_USERNAME,
      MONGODB_PASSWORD,
      MONGODB_HOST,
      MONGODB_DATABASE,
      MONGODB_URI
    } = process.env;

    const MONGODB_PROTOCOL = process.env.MONGODB_PROTOCOL || 'mongodb+srv';
    if (!MONGODB_URI) {
      return `${MONGODB_PROTOCOL}://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE}`;
    }
    return `${MONGODB_URI}`;
  }

  public async connect(): Promise<{ conn: mongoose.Connection }> {
    const connectionString = this.getDbConnectionString();

    if (
      (mongoose.connection.readyState !== 0 && mongoose.connection.readyState !== 3) ||
      global.__MONGO_CONNECTED__
    ) {
      return { conn: mongoose.connection };
    }

    try {
      const conn = await mongoose.connect(connectionString);
      global.__MONGO_CONNECTED__ = true;
      return { conn: conn.connection };
    } catch (err) {
      logger.error('[endurance-core] ❌ Échec connexion MongoDB :', err);
      throw err;
    }
  }

  public createStore(): session.Store {
    const uri = this.getDbConnectionString();

    const store = new MongoDBStore({
      uri,
      collection: 'sessions'
    });

    store.on('error', (error: Error) => {
      logger.error('[endurance-core] Erreur du store de session MongoDB :', error);
    });

    return store;
  }
}

export const enduranceDatabase = new EnduranceDatabase();
