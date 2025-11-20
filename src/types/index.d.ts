declare module 'endurance-core' {
    export { app } from './internal/app.js';

    export {
        EnduranceAuthMiddleware,
        EnduranceAccessControl,
        EnduranceAuth
    } from './core/auth.js';

    export {
        EnduranceSchema,
        EnduranceModel,
        EnduranceDocumentType,
        EnduranceModelType,
        ObjectId,
        Ref
    } from './core/schema.js';

    export {
        EnduranceRouter,
        EnduranceRequest,
        Response,
        NextFunction,
        SecurityOptions,
        FileUploadConfig
    } from './core/router.js';

    export { enduranceConsumer } from './core/consumer.js';

    export { enduranceCron } from './infra/cron.js';
    export { enduranceDatabase } from './infra/database.js';
    export { enduranceSwagger } from './infra/swagger.js';

    export {
        enduranceEmitter,
        enduranceEventTypes
    } from './core/emitter.js';

    export { enduranceListener } from './core/listener.js';

    export { enduranceNotificationManager } from './core/notification.js';
}
