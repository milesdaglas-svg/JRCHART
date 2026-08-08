import { useEffect, useRef } from "react";

export default function VideoEmbed({ platform, embedId, embedHtml }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (platform !== "tiktok" || !embedHtml || !containerRef.current) return;

    containerRef.current.innerHTML = embedHtml;

    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      if (oldScript.src) newScript.src = oldScript.src;
      else newScript.textContent = oldScript.textContent;
      newScript.async = true;
      document.body.appendChild(newScript);
    });

    const timer = setTimeout(() => {
      window.tiktokEmbed?.lib?.render?.(containerRef.current.querySelectorAll(".tiktok-embed"));
    }, 600);

    return () => clearTimeout(timer);
  }, [platform, embedHtml]);

  if (platform === "youtube" && embedId) {
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, background: "#000" }}>
        <iframe
          src={`https://www.youtube.com/embed/${embedId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
        />
      </div>
    );
  }

  if (platform === "tiktok") {
    return <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />;
  }

  return null;
}