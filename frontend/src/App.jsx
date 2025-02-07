import React, { useState, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import babelParser from 'prettier/parser-babel';
import { io } from 'socket.io-client';
import axios from 'axios';

// Initialize socket connection
const socket = io('http://localhost:5000'); // Update with your backend URL

function App() {
  const [code, setCode] = useState('// Write your code here...');
  const [theme, setTheme] = useState('vs-dark');
  const [suggestion, setSuggestion] = useState('');
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [editorInstance, setEditorInstance] = useState(null); // To hold Monaco editor instance

  // Sync code updates in real-time
  useEffect(() => {
    socket.on('codeUpdate', (updatedCode) => {
      setCode(updatedCode);
    });

    return () => {
      socket.off('codeUpdate');
    };
  }, []);

  // Handle user typing with delay (2s for AI suggestion)
  const handleCodeChange = (value) => {
    setCode(value);
    setSuggestion(''); // Clear previous suggestion
    socket.emit('codeUpdate', value);

    if (typingTimeout) clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => getCodeSuggestion(value), 2000)); // AI after 2s
  };

  // AI-based autocomplete suggestion
  const getCodeSuggestion = async (code) => {
    try {
      const response = await axios.post('http://localhost:5000/ai-completion', { code });
      setSuggestion(response.data.suggestion.trim()); // Store AI suggestion
    } catch (err) {
      console.error('Error fetching AI suggestion:', err);
    }
  };

  // Handle editor keydown event to insert suggestion at cursor position
  const handleEditorKeyDown = (e) => {
    if (e.key === 'v' && suggestion) {
      e.preventDefault(); // Prevent the default tab behavior
      insertTextAtCursor(suggestion); // Insert suggestion at the cursor
      setSuggestion(''); // Clear the suggestion
    }
  };

  // Insert text at the current cursor position
  const insertTextAtCursor = (text) => {
    if (editorInstance) {
      const position = editorInstance.getPosition(); // Get current cursor position
      const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
      const id = { major: 1, minor: 1 };

      // Execute the edit to insert text at the current cursor position
      editorInstance.executeEdits('', [
        {
          range: range,
          text: text,
          forceMoveMarkers: true,
        },
      ]);

      // Move the cursor after the inserted text
      editorInstance.setPosition({
        lineNumber: position.lineNumber,
        column: position.column + text.length,
      });

      setCode(editorInstance.getValue()); // Update the code state
    }
  };

  // Set the editor instance when it's mounted
  const handleEditorMount = (editor) => {
    setEditorInstance(editor);
  };

  // Toggle theme (Dark/Light)
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'vs-dark' ? 'vs-light' : 'vs-dark'));
  };

  // Format code using Prettier
  const formatCode = () => {
    try {
      const formattedCode = prettier.format(code, {
        parser: 'babel',
        plugins: [babelParser],
        semi: true,
        singleQuote: true,
      });
      setCode(formattedCode);
    } catch (error) {
      console.error('Error formatting code:', error);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', display: 'flex', gap: '10px' }}>
        <button onClick={toggleTheme}>Toggle Theme</button>
        <button onClick={formatCode}>Format Code</button>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <MonacoEditor
          height="90vh"
          theme={theme}
          width="100vw"
          language="javascript"
          value={code}
          onChange={handleCodeChange}
          onKeyDown={handleEditorKeyDown}
          onMount={handleEditorMount} // Set editor instance
        />
        {suggestion && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '14px',
            }}
          >
            💡 {suggestion} (Press 'Tab' to accept)
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
