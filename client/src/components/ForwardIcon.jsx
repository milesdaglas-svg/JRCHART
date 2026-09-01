export default function ForwardIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 15l5-5-5-5" />
      <path d="M20 10H9.5A6.5 6.5 0 0 0 3 16.5V19" />
    </svg>
  );
}
