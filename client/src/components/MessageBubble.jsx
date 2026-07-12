export default function MessageBubble({ message, isMine }) {
  const time = message.createdAt
    ? new Date(
        message.createdAt._seconds ? message.createdAt._seconds * 1000 : message.createdAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (message.isWarning) {
    return (
      <div className="bubble warning">
        <div>⚠️ {message.text}</div>
        <div className="bubble-meta">{time}</div>
      </div>
    );
  }

  return (
    <div className={`bubble ${isMine ? "mine" : "theirs"}`}>
      {message.isSystem && !isMine && (
        <div style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>
          {message.senderName || "System"}
        </div>
      )}
      <div>{message.text}</div>
      <div className="bubble-meta">{time}</div>
    </div>
  );
}
