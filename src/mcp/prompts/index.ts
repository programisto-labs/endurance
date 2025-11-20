// Note: Prompt type definition - MCP SDK may have different export paths
interface Prompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required?: boolean;
    }>;
}

interface PromptRegistry {
    list(): Promise<{ prompts: Prompt[] }>;
    get(name: string): Prompt | undefined;
}

const prompts: Map<string, Prompt> = new Map();

function registerPrompt(prompt: Prompt): void {
    prompts.set(prompt.name, prompt);
}

export function registerPrompts(): PromptRegistry {
    if (prompts.size === 0) {
        registerPrompt(createRouterPrompt());
        registerPrompt(createSchemaPrompt());
        registerPrompt(createModulePrompt());
        registerPrompt(createCRUDPrompt());
        registerPrompt(createEventDrivenPrompt());
    }

    return {
        async list() {
            return { prompts: Array.from(prompts.values()) };
        },
        get(name: string) {
            return prompts.get(name);
        }
    };
}

function createRouterPrompt(): Prompt {
    return {
        name: 'create-endurance-router',
        description: 'Prompt template for creating an Endurance router following framework conventions',
        arguments: [
            {
                name: 'routerName',
                description: 'Name of the router (e.g., users, products)',
                required: true
            },
            {
                name: 'routes',
                description: 'Array of routes to create. Each route should have method, path, and description',
                required: false
            },
            {
                name: 'security',
                description: 'Security requirements (permissions, requireAuth, etc.)',
                required: false
            }
        ]
    };
}

function createSchemaPrompt(): Prompt {
    return {
        name: 'create-endurance-schema',
        description: 'Prompt template for creating an Endurance schema (Typegoose model)',
        arguments: [
            {
                name: 'schemaName',
                description: 'Name of the schema (e.g., User, Product)',
                required: true
            },
            {
                name: 'fields',
                description: 'Array of field definitions with name, type, and options',
                required: false
            }
        ]
    };
}

function createModulePrompt(): Prompt {
    return {
        name: 'create-endurance-module',
        description: 'Prompt template for creating a complete Endurance module',
        arguments: [
            {
                name: 'moduleName',
                description: 'Name of the module (e.g., user-management, order-processing)',
                required: true
            },
            {
                name: 'components',
                description: 'Array of components to include (routes, listeners, consumers, crons)',
                required: false
            }
        ]
    };
}

function createCRUDPrompt(): Prompt {
    return {
        name: 'create-endurance-crud',
        description: 'Prompt template for creating CRUD operations with Endurance patterns',
        arguments: [
            {
                name: 'resourceName',
                description: 'Name of the resource (e.g., users, products)',
                required: true
            },
            {
                name: 'schema',
                description: 'Reference to the schema/model to use',
                required: true
            },
            {
                name: 'permissions',
                description: 'Permissions required for each operation (create, read, update, delete)',
                required: false
            }
        ]
    };
}

function createEventDrivenPrompt(): Prompt {
    return {
        name: 'create-endurance-event-driven',
        description: 'Prompt template for creating event-driven features with Endurance',
        arguments: [
            {
                name: 'eventName',
                description: 'Name of the event (e.g., USER_CREATED, ORDER_PROCESSED)',
                required: true
            },
            {
                name: 'emitter',
                description: 'Where the event is emitted (route, schema, service)',
                required: false
            },
            {
                name: 'listeners',
                description: 'Array of listeners that should handle this event',
                required: false
            }
        ]
    };
}
