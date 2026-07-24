import { useEffect, useRef, useState } from "react";

const SpeechRecognitionImpl =
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

function speak(text) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  window.speechSynthesis.speak(utterance);
}

/**
 * Always-listening wake-word assistant. Says "hey <aiName>" to wake it,
 * then speak a command like "reply to Lisa saying I'm on my way" and it
 * sends the message hands-free via onExecuteSend.
 *
 * Requires mic permission and a browser with the Web Speech API
 * (Chrome/Edge). Listening only runs while the toggle is on and the tab
 * is focused — this is a browser limitation, not something we can bypass.
 */
export default function VoiceAssistant({ aiName, groups, activeGroupId, authedFetch, onExecuteSend }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("off"); // off | listening | awake | thinking
  const [lastHeard, setLastHeard] = useState("");
  const recognitionRef = useRef(null);
  const awakeRef = useRef(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (!SpeechRecognitionImpl) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      setLastHeard(transcript);

      const wakePattern = new RegExp(`\\bhey\\s+${aiName}\\b`, "i");

      if (!awakeRef.current) {
        if (wakePattern.test(transcript) || new RegExp(`\\b${aiName}\\b`, "i").test(transcript)) {
          awakeRef.current = true;
          setStatus("awake");
          speak("At your service.");
          // If they said the wake word plus a command in the same breath, use the remainder.
          const remainder = transcript.replace(wakePattern, "").replace(new RegExp(aiName, "i"), "").trim();
          if (remainder.length > 3) {
            await handleCommand(remainder);
          }
        }
        return;
      }

      // Already awake: whatever they say next is the command.
      awakeRef.current = false;
      setStatus("listening");
      await handleCommand(transcript);
    };

    recognition.onend = () => {
      if (enabledRef.current) recognition.start(); // keep it alive while enabled
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [aiName]);

  async function handleCommand(transcript) {
    setStatus("thinking");
    try {
      const availableGroups = groups.map((g) => ({ id: g.id, name: g.name }));
      const result = await authedFetch("/api/ai/command", {
        method: "POST",
        body: JSON.stringify({ transcript, availableGroups, activeGroupId }),
      });

      if (result.action === "send" && result.groupId && result.message) {
        await onExecuteSend(result.groupId, result.message);
      }
      speak(result.speech || "Done.");
    } catch (err) {
      speak("Sorry, something went wrong with that.");
    } finally {
      setStatus(enabledRef.current ? "listening" : "off");
    }
  }

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    if (!recognitionRef.current) return;

    if (next) {
      setStatus("listening");
      recognitionRef.current.start();
      speak(`Listening for "hey ${aiName}".`);
    } else {
      setStatus("off");
      recognitionRef.current.stop();
    }
  }

  if (!SpeechRecognitionImpl) {
    return (
      <div style={{ fontSize: "0.75rem", color: "rgba(247,244,234,0.55)", padding: "0 16px" }}>
        Voice assistant needs Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={toggle}
        style={{
          fontSize: "0.8rem",
          padding: "6px 12px",
          borderRadius: 8,
          background: "transparent",
          border: `1.5px solid ${enabled ? "var(--accent)" : "var(--border)"}`,
          color: enabled ? "var(--accent)" : "var(--text-secondary)",
        }}
        title={`Say "hey ${aiName}" to wake it up`}
      >
        🎙️ {aiName}: {status}
      </button>
    </div>
  );
}
