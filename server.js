// server.js (create this at root level, same as graph.json)
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());

// Read graph.json from src directory
const graphData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'graph.json'), 'utf8')
);

// Create the API endpoint
app.get('/api/v1/clinic/intake/workflow/graph', (req, res) => {
  res.json(graphData);
});

// Health check
app.get('/', (req, res) => {
  res.send('Patient Intake API Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/v1/clinic/intake/workflow/graph`);
});