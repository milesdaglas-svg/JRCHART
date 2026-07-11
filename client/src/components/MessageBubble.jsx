export default function MessageBubble({ message, isMine }) {
  const time = message.createdAt
    ? new Date(
        message.createdAt._seconds ? message.createdAt._seconds * 1000 : message.createdAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`bubble ${isMine ? "mine" : "theirs"}`}>
      <div>{message.text}</div>
      <div className="bubble-meta">{time}</div>
    </div>
  );
}
