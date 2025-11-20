import mongoose from 'mongoose';
import logger from './logger.js';
import { enduranceEmitter } from './emitter.js';

let isDistributed = false;
const replicatedEvents = new WeakSet<object>();

// Fonction pour nettoyer les objets des références circulaires
const sanitizeForBSON = (obj: any, seen = new WeakSet()): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    if (seen.has(obj)) {
        return '[Circular Reference]';
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForBSON(item, seen));
    }

    if (obj instanceof Date) {
        return obj;
    }

    if (obj instanceof Buffer) {
        return obj;
    }

    const sanitized: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            try {
                sanitized[key] = sanitizeForBSON(obj[key], seen);
            } catch (error) {
                sanitized[key] = '[Error serializing]';
            }
        }
    }

    return sanitized;
};

export const setupDistributedEmitter = async (db: mongoose.mongo.Db) => {
    // Vérifier si les événements distribués sont activés
    const enableDistributed = process.env.ENABLE_DISTRIBUTED_EVENTS === 'true';

    if (!enableDistributed) {
        return;
    }

    try {
        const instanceId = `instance_${Math.random().toString(36).slice(2)}`;
        const collection = db.collection('endurance_events');

        enduranceEmitter.onAny((event, ...payload) => {
            const maybeWrapper = payload.at(-1);
            if (maybeWrapper && typeof maybeWrapper === 'object' && replicatedEvents.has(maybeWrapper)) return;

            // Nettoyer le payload des références circulaires
            const sanitizedPayload = sanitizeForBSON(payload);

            collection.insertOne({
                event,
                payload: sanitizedPayload,
                source: instanceId,
                createdAt: new Date()
            }).catch(err =>
                logger.error('[emitter] Failed to write event to MongoDB', err)
            );
        });

        const changeStream = collection.watch([], { fullDocument: 'updateLookup' });
        changeStream.on('change', change => {
            if (change.operationType === 'insert') {
                const doc = change.fullDocument;
                if (doc.source !== instanceId) {
                    const eventWrapper = { event: doc.event, payload: doc.payload };
                    replicatedEvents.add(eventWrapper);
                    enduranceEmitter.emit(doc.event, ...doc.payload, eventWrapper);
                }
            }
        });
        isDistributed = true;
        logger.info('[emitter] Distributed emitter setup completed successfully');
    } catch (err) {
        logger.warn('[emitter] Failed to set up distributed emitter', err);
    }
};

export const IS_DISTRIBUTED_EMITTER = () => isDistributed;

// Fonction helper pour vérifier si les événements distribués sont activés
export const IS_DISTRIBUTED_ENABLED = () => process.env.ENABLE_DISTRIBUTED_EVENTS === 'true';
