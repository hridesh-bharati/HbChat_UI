import React, { useEffect, useState, useRef } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

const SERVER_URL = `http://${window.location.hostname}:3000`;
const socket = io(SERVER_URL, { autoConnect: false });

function getInitials(name) {
  const parts = name.trim().split(" ");
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const videoConstraints = {
  width: 320,
  height: 240,
  facingMode: "user",
};

function CameraCapture({ onCapture, onCancel }) {
  const webcamRef = useRef(null);
  const [capturedImg, setCapturedImg] = useState(null);

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImg(imageSrc);
      onCapture(imageSrc);
    }
  };

  const retake = () => {
    setCapturedImg(null);
    onCapture(null);
  };

  return (
    <div style={{ textAlign: "center", marginBottom: 10 }}>
      {!capturedImg ? (
        <>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            style={{ borderRadius: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={capture} style={{ marginRight: 10 }}>
              Capture
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  background: "none",
                  border: "none",
                  color: "red",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <img
            src={capturedImg}
            alt="Captured"
            style={{ width: 320, height: 240, borderRadius: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={retake}>Retake</button>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const [userData, setUserData] = useState(() => {
    const saved = localStorage.getItem("userData");
    return saved ? JSON.parse(saved) : null;
  });
  const [isConnected, setIsConnected] = useState(!!userData);
  const [loginName, setLoginName] = useState("");
  const [loginDp, setLoginDp] = useState(null);
  const [showCameraLogin, setShowCameraLogin] = useState(false);

  const [chat, setChat] = useState(() => {
    const saved = localStorage.getItem("chat");
    return saved ? JSON.parse(saved) : [];
  });
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [usersTyping, setUsersTyping] = useState([]);
  const [systemMessages, setSystemMessages] = useState([]);
  const [showCameraChangeDP, setShowCameraChangeDP] = useState(false);

  const chatEndRef = useRef();
  const typingTimeout = useRef();

  useEffect(() => {
    localStorage.setItem("chat", JSON.stringify(chat));
  }, [chat]);

  useEffect(() => {
    if (!isConnected || !userData) return;

    socket.connect();
    socket.emit("user_joined", userData);

    socket.on("receive_message", (msg) => setChat((prev) => [...prev, msg]));
    socket.on("delete_message", (msgId) =>
      setChat((prev) => prev.filter((m) => m.id !== msgId))
    );
    socket.on("typing", (ud) => {
      if (ud.userId !== userData.userId) {
        setUsersTyping((prev) =>
          prev.includes(ud.username) ? prev : [...prev, ud.username]
        );
      }
    });
    socket.on("stop_typing", (ud) =>
      setUsersTyping((prev) => prev.filter((u) => u !== ud.username))
    );
    socket.on("user_joined", (ud) =>
      setSystemMessages((prev) => [
        ...prev,
        { type: "joined", userData: ud, timestamp: Date.now() },
      ])
    );
    socket.on("user_left", (ud) =>
      setSystemMessages((prev) => [
        ...prev,
        { type: "left", userData: ud, timestamp: Date.now() },
      ])
    );

    return () => {
      socket.disconnect();
      setUsersTyping([]);
      setSystemMessages([]);
    };
  }, [isConnected, userData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, systemMessages]);

  const doLogin = () => {
    if (!loginName.trim()) return;
    const newUser = {
      userId: uuidv4(),
      username: loginName,
      dp: loginDp,
    };
    localStorage.setItem("userData", JSON.stringify(newUser));
    setUserData(newUser);
    setIsConnected(true);
    setShowCameraLogin(false);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    const msg = {
      id: uuidv4(),
      ...userData,
      text: message,
      timestamp: new Date().toISOString(),
    };
    socket.emit("send_message", msg);
    setMessage("");
    socket.emit("stop_typing", userData);
  };

  const deleteMessage = (id) => {
    socket.emit("delete_message", id);
  };

  const handleInput = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", userData);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socket.emit("stop_typing", userData),
      1000
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        e.preventDefault();
        setMessage((m) => m + "\n");
      } else {
        e.preventDefault();
        if (isConnected) {
          sendMessage();
        } else {
          doLogin();
        }
      }
    }
  };

  const emojis = ["😀", "😂", "😍", "😎", "👍", "💬", "🔥", "🚀", "🎉"];

  // Upload DP helper
  const handleFileUpload = (file, setter) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result);
      reader.readAsDataURL(file);
    }
  };

  if (!isConnected) {
    return (
      <div style={styles.loginContainer}>
        <h2 style={{ color: "#1976d2" }}>Join the Chat</h2>
        <input
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your name"
          style={styles.input}
          autoFocus
        />

        {!showCameraLogin ? (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files[0], setLoginDp)}
              style={{ marginBottom: 10 }}
            />
            <div>
              <button
                onClick={() => setShowCameraLogin(true)}
                style={{ marginRight: 10 }}
              >
                Use Camera
              </button>
              <button onClick={doLogin} style={styles.button}>
                Enter
              </button>
            </div>
          </>
        ) : (
          <CameraCapture
            onCapture={(img) => setLoginDp(img)}
            onCancel={() => setShowCameraLogin(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.profileInfo}>
          {userData.dp ? (
            <img src={userData.dp} alt="DP" style={styles.profileDp} />
          ) : (
            <div style={styles.initialsCircleHeader}>
              {getInitials(userData.username)}
            </div>
          )}
          <span>{userData.username}</span>
        </div>
        <div style={styles.headerActions}>
          {!showCameraChangeDP ? (
            <>
              <label style={styles.changeDpBtn}>
                Change DP (Upload)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    handleFileUpload(file, (img) => {
                      const updated = { ...userData, dp: img };
                      localStorage.setItem("userData", JSON.stringify(updated));
                      setUserData(updated);
                      socket.emit("user_joined", updated);
                    });
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <button
                onClick={() => setShowCameraChangeDP(true)}
                style={{ marginLeft: 5, cursor: "pointer", fontSize: 10 }}
              >
                Change DP (Camera)
              </button>
            </>
          ) : (
            <CameraCapture
              onCapture={(img) => {
                if (img) {
                  const updated = { ...userData, dp: img };
                  localStorage.setItem("userData", JSON.stringify(updated));
                  setUserData(updated);
                  socket.emit("user_joined", updated);
                }
                setShowCameraChangeDP(false);
              }}
              onCancel={() => setShowCameraChangeDP(false)}
            />
          )}

          <button
            onClick={() => {
              localStorage.removeItem("userData");
              localStorage.removeItem("chat");
              setIsConnected(false);
              setUserData(null);
              setChat([]);
              setSystemMessages([]);
              socket.disconnect();
            }}
            style={styles.logoutBtn}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={styles.chatArea}>
        {systemMessages.map((sys, idx) => (
          <div key={"sys" + idx} style={styles.systemMessage}>
            {sys.userData.username}{" "}
            {sys.type === "joined" ? "joined the chat." : "left the chat."}
          </div>
        ))}

        {chat.map((msg) => {
          const isMe = msg.userId === userData.userId;
          return (
            <div
              key={msg.id}
              style={{
                ...styles.messageContainer,
                justifyContent: isMe ? "flex-end" : "flex-start",
              }}
            >
              {!isMe &&
                (msg.dp ? (
                  <img src={msg.dp} alt="dp" style={styles.dpImage} />
                ) : (
                  <div style={styles.initialsCircle}>{getInitials(msg.username)}</div>
                ))}
              <div
                style={{
                  ...styles.message,
                  backgroundColor: isMe ? "#1976d2" : "#e5e5ea",
                  color: isMe ? "white" : "black",
                }}
              >
                <div style={styles.messageHeader}>
                  <b>{msg.username}</b>
                  <span style={styles.time}>{formatTime(msg.timestamp)}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                {isMe && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    style={styles.deleteBtn}
                    title="Delete message"
                  >
                    ×
                  </button>
                )}
              </div>
              {isMe &&
                (msg.dp ? (
                  <img src={msg.dp} alt="dp" style={styles.dpImage} />
                ) : (
                  <div style={styles.initialsCircle}>{getInitials(msg.username)}</div>
                ))}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div style={styles.typingArea}>
        {usersTyping.length > 0 && (
          <div style={styles.typingText}>
            {usersTyping.join(", ")} {usersTyping.length === 1 ? "is" : "are"} typing...
          </div>
        )}
      </div>

      <div style={styles.inputArea}>
        <textarea
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={2}
          style={styles.textarea}
        />
        <button onClick={() => setShowEmoji((v) => !v)} style={styles.emojiBtn}>
          😊
        </button>
        <button onClick={sendMessage} style={styles.sendBtn}>
          Send
        </button>
      </div>

      {showEmoji && (
        <div style={styles.emojiPicker}>
          {emojis.map((emj) => (
            <button
              key={emj}
              onClick={() => {
                setMessage((m) => m + emj);
                setShowEmoji(false);
              }}
              style={styles.emoji}
            >
              {emj}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  loginContainer: {
    maxWidth: 360,
    margin: "80px auto",
    padding: 20,
    border: "1px solid #ddd",
    borderRadius: 8,
    backgroundColor: "white",
    textAlign: "center",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  input: {
    width: "100%",
    padding: 8,
    fontSize: 16,
    borderRadius: 4,
    border: "1px solid #ccc",
    marginBottom: 12,
  },
  button: {
    padding: "8px 16px",
    fontSize: 16,
    backgroundColor: "#1976d2",
    border: "none",
    color: "white",
    borderRadius: 4,
    cursor: "pointer",
  },

  container: {
    maxWidth: 600,
    margin: "20px auto",
    border: "1px solid #ddd",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    height: "90vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "white",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #ddd",
    padding: "8px 16px",
  },
  profileInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: "bold",
    fontSize: 18,
    color: "#1976d2",
  },
  profileDp: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
  },
  initialsCircleHeader: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: "#1976d2",
    color: "white",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontWeight: "bold",
    fontSize: 18,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
  },
  changeDpBtn: {
    backgroundColor: "#1976d2",
    color: "white",
    padding: "6px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 9,
    userSelect: "none",
  },
  logoutBtn: {
    marginLeft: 12,
    backgroundColor: "#e53935",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 10,
  },

  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    backgroundColor: "#f9f9f9",
  },
  systemMessage: {
    textAlign: "center",
    fontStyle: "italic",
    color: "#666",
    fontSize: 12,
  },
  messageContainer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  message: {
    maxWidth: "70%",
    padding: "8px 12px",
    borderRadius: 12,
    position: "relative",
    wordBreak: "break-word",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 12,
    opacity: 0.8,
  },
  time: {
    fontSize: 10,
    color: "#999",
    marginLeft: 8,
  },
  dpImage: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    objectFit: "cover",
  },
  initialsCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#1976d2",
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    position: "absolute",
    top: 4,
    right: 6,
    background: "transparent",
    border: "none",
    color: "#f44336",
    fontSize: 18,
    cursor: "pointer",
  },

  typingArea: {
    minHeight: 24,
    marginLeft: 16,
    marginBottom: 4,
  },
  typingText: {
    fontStyle: "italic",
    fontSize: 12,
    color: "#555",
  },

  inputArea: {
    display: "flex",
    padding: 8,
    borderTop: "1px solid #ddd",
    gap: 8,
    alignItems: "center",
    backgroundColor: "white",
  },
  textarea: {
    flex: 1,
    resize: "none",
    padding: 8,
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 14,
    fontFamily: "inherit",
  },
  emojiBtn: {
    fontSize: 24,
    border: "none",
    background: "none",
    cursor: "pointer",
    userSelect: "none",
  },
  sendBtn: {
    padding: "8px 12px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
  },

  emojiPicker: {
    position: "absolute",
    bottom: 64,
    right: 16,
    backgroundColor: "white",
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 8,
    display: "flex",
    gap: 6,
    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
  },
  emoji: {
    fontSize: 20,
    cursor: "pointer",
    background: "none",
    border: "none",
  },
};

export default App;
