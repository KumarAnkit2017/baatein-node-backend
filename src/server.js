const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const { setupSockets } = require('./sockets');

const start = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl === '*' ? true : [env.clientUrl],
      credentials: true
    }
  });

  app.set('io', io);
  setupSockets(io);

  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(`Baatein backend running on ${env.host}:${env.port}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
