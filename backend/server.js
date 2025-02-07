const http = require("http");
const socketIo = require("socket.io");
const { OpenAI } = require('openai');  // Import the OpenAI library
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
// Setup server and socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',  // The URL of your frontendF
    methods: ['GET', 'POST'],         // HTTP methods allowed
    allowedHeaders: ['Content-Type'], // Allowed headers
  },
});
// Enable CORS for all origins
app.use(cors({
  origin: 'http://localhost:5173', // Or '*' to allow all origins
}));

const model = "facebook/opt-125m";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// MongoDB connection
mongoose.connect('mongodb://localhost/monaco-ai-editor', { useNewUrlParser: true, useUnifiedTopology: true });

// MongoDB schema for code snippets
const CodeSnippetSchema = new mongoose.Schema({
  code: String,
  user: String,
  version: Number,
});
const CodeSnippet = mongoose.model('CodeSnippet', CodeSnippetSchema);

// Middleware
app.use(express.json());

// Socket.io: Broadcast code updates to other users
io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('codeUpdate', (code) => {
    socket.broadcast.emit('codeUpdate', code); // Broadcast the updated code
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

app.post('/ai-completion', async (req, res) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: `only suggest the next line in sequence \n ${req.body.code}` }]
          }
        ]
      }
    );

    const suggestion = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    console.log(suggestion)
    res.json({ suggestion });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'AI model request failed' });
  }
});

// API to save code snippets
app.post('/saveCode', async (req, res) => {
  const { code, user } = req.body;
  const newSnippet = new CodeSnippet({ code, user, version: 1 });
  await newSnippet.save();
  res.status(200).send('Code saved');
});

// API to load code snippets
app.get('/loadCode/:id', async (req, res) => {
  const snippet = await CodeSnippet.findById(req.params.id);
  res.json(snippet);
});

// Start the server
server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});