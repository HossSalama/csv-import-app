const express = require('express');
const importRoutes = require('./routes/import.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/imports', importRoutes);

app.use(notFoundHandler);
app.use(errorHandler); // must be registered last

module.exports = app;
