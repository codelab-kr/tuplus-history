import express from 'express';
import { MongoClient } from 'mongodb';
import { connect } from 'amqplib';
import { json } from 'body-parser';

if (!process.env.PORT) {
  throw new Error(
    'Please specify the port number for the HTTP server with the environment variable PORT.',
  );
}

if (!process.env.DBHOST) {
  throw new Error(
    'Please specify the databse host using environment variable DBHOST.',
  );
}

if (!process.env.DBNAME) {
  throw new Error(
    'Please specify the name of the database using environment variable DBNAME',
  );
}

if (!process.env.RABBIT) {
  throw new Error(
    'Please specify the name of the RabbitMQ host using environment variable RABBIT',
  );
}

const { PORT } = process.env;
const { DBHOST } = process.env;
const { DBNAME } = process.env;
const { RABBIT } = process.env;

//
// Application entry point.
//
async function main() {
  const app = express();

  //
  // Enables JSON body parsing for HTTP requests.
  //
  app.use(json());

  //
  // Connects to the database server.
  //
  const client = await MongoClient.connect(DBHOST);

  //
  // Gets the database for this microservice.
  //
  const db = client.db(DBNAME);

  //
  // Gets the collection for storing video viewing history.
  //
  const historyCollection = db.collection('history');

  //
  // Connects to the RabbitMQ server.
  //
  const messagingConnection = await connect(RABBIT);

  //
  // Creates a RabbitMQ messaging channel.
  //
  const messageChannel = await messagingConnection.createChannel();

  //
  // Asserts that we have a "viewed" exchange.
  //
  await messageChannel.assertExchange('viewed', 'fanout');

  //
  // Creates an anonyous queue.
  //
  const { queue } = await messageChannel.assertQueue('', { exclusive: true });

  console.log(`Created queue ${queue}, binding it to "viewed" exchange.`);

  //
  // Binds the queue to the exchange.
  //
  await messageChannel.bindQueue(queue, 'viewed', '');

  //
  // Start receiving messages from the anonymous queue.
  //
  await messageChannel.consume(queue, async (msg) => {
    console.log("Received a 'viewed' message    ");

    if (!msg) {
      return;
    }
    const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.

    const videoMetadata = {
      videoId: parsedMsg.video.id,
      watched: new Date(),
      name: parsedMsg.video.name,
    };

    await historyCollection.insertOne(videoMetadata); // Record the "view" in the database.

    console.log('Acknowledging message was handled.');

    messageChannel.ack(msg); // If there is no error, acknowledge the message.
  });

  //
  // HTTP GET route to retrieve video viewing history.
  //
  app.get('/history', async (req, res) => {
    //
    // Retreives viewing history from database.
    // In a real application this should be paginated.
    //
    const history = await historyCollection.find().toArray();
    res.json({ history });
  });

  //
  // Starts the HTTP server.
  //
  app.listen(PORT, () => {
    console.log('Microservice online.');
  });
}

main().catch((err) => {
  console.error('Microservice failed to start.');
  console.error((err && err.stack) || err);
});
