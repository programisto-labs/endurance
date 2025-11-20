import { createConsumer as createAmqpConsumer } from '../consumers/amqp.consumer.js';
import { createConsumer as createKafkaConsumer } from '../consumers/kafka.consumer.js';

type ConsumerType = 'amqp' | 'kafka';

interface AmqpConsumerOptions {
  url: string;
  queue: string;
}

interface KafkaConsumerOptions {
  brokers: string[];
  groupId: string;
  topic: string;
}

type ConsumerOptions = AmqpConsumerOptions | KafkaConsumerOptions;

type MessageCallback = (messageContent: string) => void;

class EnduranceConsumer {
  public async createConsumer(
    type: ConsumerType,
    options: ConsumerOptions,
    callback: MessageCallback
  ): Promise<void> {
    switch (type) {
      case 'amqp':
        if (!('url' in options) || !('queue' in options)) {
          throw new Error('Invalid options for AMQP consumer');
        }
        return createAmqpConsumer(options, callback);
      case 'kafka':
        if (
          !('brokers' in options) ||
          !('groupId' in options) ||
          !('topic' in options)
        ) {
          throw new Error('Invalid options for Kafka consumer');
        }
        return createKafkaConsumer(options, callback);
      default:
        throw new Error('Unsupported event type');
    }
  }
}

export const enduranceConsumer = new EnduranceConsumer();
