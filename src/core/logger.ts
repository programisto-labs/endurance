import fs from 'fs';
import path from 'path';
import pino from 'pino';
import pinoCaller from 'pino-caller';
import rfs from 'rotating-file-stream';

// ✅ Create logs dir
const logDirectory = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// ✅ Transports à activer selon config
const targets: any[] = [];

// Console (pretty)
targets.push({
    target: 'pino-pretty',
    options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        errorLikeObjectKeys: ['err', 'error'],
        errorProps: 'message,stack,code,errno,syscall,path'
    },
    level: process.env.LOG_LEVEL || 'info'
});

// Fichier local
if (process.env.LOGGER_LOCAL_ACTIVATED === 'true') {
    targets.push({
        target: 'pino/file',
        options: {
            destination: path.join(logDirectory, 'app.log')
        },
        level: 'info'
    });
}

// Loki distant
if (process.env.LOGGER_DISTANT_ACTIVATED === 'true') {
    const lokiOptions: any = {
        host: process.env.LOGGER_DISTANT_URL || '',
        labels: {
            job: process.env.LOGGER_DISTANT_APP_NAME || 'nodejs_app'
        }
    };

    if (process.env.LOKI_USERNAME && process.env.LOKI_PASSWORD) {
        lokiOptions.basicAuth = {
            username: process.env.LOKI_USERNAME,
            password: process.env.LOKI_PASSWORD
        };
    }

    if (process.env.LOKI_TOKEN) {
        lokiOptions.headers = {
            Authorization: `Bearer ${process.env.LOKI_TOKEN}`
        };
    }

    targets.push({
        target: 'pino-loki',
        options: lokiOptions,
        level: 'info'
    });
}

// Création du transport combiné
const transport = pino.transport({
    targets
});

// ✅ Création du logger avec transport multi-sortie
const baseLogger = pino(
    {
        level: process.env.LOG_LEVEL || 'info'
    },
    transport
);

// Création du logger avec caller
const baseLoggerWithCaller = pinoCaller(baseLogger, {
    relativeTo: process.cwd()
});

// Fonction helper pour formater les messages avec arguments multiples
const formatMessage = (msg: any, ...args: any[]) => {
    if (args.length === 0) return msg;
    return [msg, ...args].map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
};

// Fonctions helper qui préservent l'information de l'appelant
export const logInfo = (msg: any, ...args: any[]) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.info({ msg, err: serializeError(args[0]) });
    } else if (args.length >= 2 && typeof args[args.length - 1] === 'object') {
        // Cas spécial pour logger.info("message", err)
        const errorObj = args[args.length - 1];
        const message = args.length === 2 ? msg : formatMessage(msg, ...args.slice(0, -1));
        baseLoggerWithCaller.info({ msg: message, err: serializeError(errorObj) });
    } else {
        baseLoggerWithCaller.info(formatMessage(msg, ...args));
    }
};

export const logWarn = (msg: any, ...args: any[]) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.warn({ msg, err: serializeError(args[0]) });
    } else if (args.length >= 2 && typeof args[args.length - 1] === 'object') {
        // Cas spécial pour logger.warn("message", err)
        const errorObj = args[args.length - 1];
        const message = args.length === 2 ? msg : formatMessage(msg, ...args.slice(0, -1));
        baseLoggerWithCaller.warn({ msg: message, err: serializeError(errorObj) });
    } else {
        baseLoggerWithCaller.warn(formatMessage(msg, ...args));
    }
};

export const logError = (msg: any, ...args: any[]) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.error({ msg, err: serializeError(args[0]) });
    } else if (args.length >= 2 && typeof args[args.length - 1] === 'object') {
        // Cas spécial pour logger.error("message", err)
        const errorObj = args[args.length - 1];
        const message = args.length === 2 ? msg : formatMessage(msg, ...args.slice(0, -1));
        baseLoggerWithCaller.error({ msg: message, err: serializeError(errorObj) });
    } else {
        baseLoggerWithCaller.error(formatMessage(msg, ...args));
    }
};

export const logDebug = (msg: any, ...args: any[]) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.debug({ msg, err: serializeError(args[0]) });
    } else if (args.length >= 2 && typeof args[args.length - 1] === 'object') {
        // Cas spécial pour logger.debug("message", err)
        const errorObj = args[args.length - 1];
        const message = args.length === 2 ? msg : formatMessage(msg, ...args.slice(0, -1));
        baseLoggerWithCaller.debug({ msg: message, err: serializeError(errorObj) });
    } else {
        baseLoggerWithCaller.debug(formatMessage(msg, ...args));
    }
};

// Fonction pour sérialiser les erreurs
const serializeError = (err: any) => {
    if (err instanceof Error) {
        return {
            message: err.message,
            stack: err.stack,
            name: err.name,
            ...Object.getOwnPropertyNames(err).reduce((acc, key) => {
                if (key !== 'message' && key !== 'stack' && key !== 'name') {
                    acc[key] = (err as any)[key];
                }
                return acc;
            }, {} as any)
        };
    }
    return err;
};

// Rediriger console.* vers logger
console.log = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.info(serializeError(args[0]));
    } else if (args.length === 2 && typeof args[1] === 'object') {
        baseLoggerWithCaller.info({ msg: args[0], err: serializeError(args[1]) });
    } else {
        // Pour les arguments multiples, créer un message formaté
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        baseLoggerWithCaller.info(message);
    }
};
console.info = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.info(serializeError(args[0]));
    } else if (args.length === 2 && typeof args[1] === 'object') {
        baseLoggerWithCaller.info({ msg: args[0], err: serializeError(args[1]) });
    } else {
        // Pour les arguments multiples, créer un message formaté
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        baseLoggerWithCaller.info(message);
    }
};
console.warn = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.warn(serializeError(args[0]));
    } else if (args.length === 2 && typeof args[1] === 'object') {
        baseLoggerWithCaller.warn({ msg: args[0], err: serializeError(args[1]) });
    } else {
        // Pour les arguments multiples, créer un message formaté
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        baseLoggerWithCaller.warn(message);
    }
};
console.error = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.error(serializeError(args[0]));
    } else if (args.length >= 2 && typeof args[args.length - 1] === 'object') {
        // Cas spécial pour logger.error("message", err)
        const errorObj = args[args.length - 1];
        const message = args.length === 2 ? args[0] : args.slice(0, -1).join(' ');
        // Utiliser le logger de base pour préserver l'information de l'appelant
        baseLogger.error({ msg: message, err: serializeError(errorObj) });
    } else {
        // Pour les arguments multiples, créer un message formaté
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        baseLoggerWithCaller.error(message);
    }
};
console.debug = (...args) => {
    if (args.length === 1 && typeof args[0] === 'object') {
        baseLoggerWithCaller.debug(serializeError(args[0]));
    } else if (args.length === 2 && typeof args[1] === 'object') {
        baseLoggerWithCaller.debug({ msg: args[0], err: serializeError(args[1]) });
    } else {
        // Pour les arguments multiples, créer un message formaté
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        baseLoggerWithCaller.debug(message);
    }
};

// Morgan stream
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',
    path: logDirectory
});

export const morganStream = {
    write: (message: string) => {
        accessLogStream.write(message);
        baseLoggerWithCaller.info(message.trim());
    }
};

// Créer un wrapper qui préserve l'information de l'appelant
const createLoggerWithCaller = () => {
    const logger = {
        info: (msg: any, ...args: any[]) => {
            if (args.length >= 1 && typeof args[args.length - 1] === 'object') {
                const errorObj = args[args.length - 1];
                const message = args.length === 1 ? msg : formatMessage(msg, ...args.slice(0, -1));
                baseLoggerWithCaller.info({ msg: message, err: serializeError(errorObj) });
            } else {
                baseLoggerWithCaller.info(formatMessage(msg, ...args));
            }
        },
        warn: (msg: any, ...args: any[]) => {
            if (args.length >= 1 && typeof args[args.length - 1] === 'object') {
                const errorObj = args[args.length - 1];
                const message = args.length === 1 ? msg : formatMessage(msg, ...args.slice(0, -1));
                baseLoggerWithCaller.warn({ msg: message, err: serializeError(errorObj) });
            } else {
                baseLoggerWithCaller.warn(formatMessage(msg, ...args));
            }
        },
        error: (msg: any, ...args: any[]) => {
            if (args.length >= 1 && typeof args[args.length - 1] === 'object') {
                const errorObj = args[args.length - 1];
                const message = args.length === 1 ? msg : formatMessage(msg, ...args.slice(0, -1));
                // Créer un nouvel objet Error pour capturer la stack trace de l'appelant
                const callerError = new Error();
                Error.captureStackTrace(callerError, logger.error);
                // Utiliser le logger de base pour préserver l'information de l'appelant
                baseLogger.error({ msg: message, err: serializeError(errorObj), caller: callerError.stack });
            } else {
                baseLoggerWithCaller.error(formatMessage(msg, ...args));
            }
        },
        debug: (msg: any, ...args: any[]) => {
            if (args.length >= 1 && typeof args[args.length - 1] === 'object') {
                const errorObj = args[args.length - 1];
                const message = args.length === 1 ? msg : formatMessage(msg, ...args.slice(0, -1));
                baseLoggerWithCaller.debug({ msg: message, err: serializeError(errorObj) });
            } else {
                baseLoggerWithCaller.debug(formatMessage(msg, ...args));
            }
        },
        child: baseLoggerWithCaller.child.bind(baseLoggerWithCaller)
    };
    return logger;
};

export default createLoggerWithCaller();
