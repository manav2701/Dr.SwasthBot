import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);

  // 1. On mount, fetch list of chat IDs
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/chats');
        if (res.data.success) setChats(res.data.chats);
      } catch (err) {
        console.error(err);
      }
    };
    fetchChats();
  }, []);

  // 2. When a chat is selected, fetch its history
  useEffect(() => {
    if (!selectedChat) return;
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/api/chats/${selectedChat}`);
        if (res.data.success) setMessages(res.data.messages);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, [selectedChat]);

  return (
    <div style={{ display: 'flex', padding: '2rem', fontFamily: 'sans-serif' }}>
      {/* Sidebar: List of chat IDs */}
      <div style={{ width: '200px', marginRight: '2rem' }}>
        <h2>Chats</h2>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {chats.map((chatId) => (
            <li key={chatId} style={{ margin: '0.5rem 0' }}>
              <button
                style={{
                  background: chatId === selectedChat ? '#007bff' : '#eee',
                  color: chatId === selectedChat ? '#fff' : '#000',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedChat(chatId)}
              >
                {chatId}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Main: Messages */}
      <div style={{ flex: 1 }}>
        <h2>Conversation</h2>
        {!selectedChat ? (
          <p>Select a chat ID to view messages.</p>
        ) : (
          <div style={{ maxHeight: '80vh', overflowY: 'auto', border: '1px solid #ccc', padding: '1rem' }}>
            {messages.map((msg) => (
              <div key={msg._id} style={{ marginBottom: '1rem' }}>
                <div>
                  <strong>User:</strong> {msg.userMessage}
                </div>
                <div style={{ marginTop: '0.25rem', color: '#007bff' }}>
                  <strong>Agent:</strong> {msg.agentReply}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
                <hr />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
