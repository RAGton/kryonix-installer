export default function EagleLogo({ className = "w-5 h-5" }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2L2 9L5 22L12 17L19 22L22 9L12 2Z" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="text-accent-blue"
      />
      <path 
        d="M12 17L12 2" 
        stroke="currentColor" 
        strokeWidth="1.5"
        className="text-accent-blue/50"
      />
      <path 
        d="M5 22L12 11L19 22" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="text-accent-cyan"
      />
    </svg>
  );
}
