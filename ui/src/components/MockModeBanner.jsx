export default function MockModeBanner() {
  if (import.meta.env.VITE_INSTALLER_MOCK !== '1') return null;

  return (
    <div className="absolute top-4 right-4 z-50 pointer-events-none">
      <div className="bg-warning/10 border border-warning/20 text-warning px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm flex items-center gap-1.5 backdrop-blur-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></div>
        Mock Mode
      </div>
    </div>
  );
}
