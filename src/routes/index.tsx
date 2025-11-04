import { createFileRoute } from "@tanstack/react-router";
 
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const TITLE_TS_START = `
 ████████╗███████╗    ███████╗████████╗ █████╗ ██████╗ ████████╗
 ╚══██╔══╝██╔════╝    ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝
    ██║   ███████╗    ███████╗   ██║   ███████║██████╔╝   ██║   
    ██║   ╚════██║    ╚════██║   ██║   ██╔══██║██╔══██╗   ██║   
    ██║   ███████║    ███████║   ██║   ██║  ██║██║  ██║   ██║   
    ╚═╝   ╚══════╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   
`;

const TITLE_CONVEX = `
 ██████╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██╗  ██╗
██╔════╝██╔═══██╗████╗  ██║██║   ██║██╔════╝╚██╗██╔╝
██║     ██║   ██║██╔██╗ ██║██║   ██║█████╗   ╚███╔╝ 
██║     ██║   ██║██║╚██╗██║╚██╗ ██╔╝██╔══╝   ██╔██╗ 
╚██████╗╚██████╔╝██║ ╚████║ ╚████╔╝ ███████╗██╔╝ ██╗
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
`;

function HomeComponent() {
  const [mounted] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* top-right primary orb */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-float" />
        {/* bottom-left balancing orb */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-float-delayed" />
        {/* top-left subtle orb for symmetry */}
        <div className="absolute -top-20 -left-24 w-56 h-56 bg-gradient-to-br from-cyan-400/15 to-blue-500/15 rounded-full blur-[72px] animate-float" />
        {/* bottom-right subtle orb for symmetry */}
        <div className="absolute -bottom-24 -right-28 w-64 h-64 bg-gradient-to-tr from-violet-400/15 to-fuchsia-500/15 rounded-full blur-[76px] animate-float-delayed" />
      </div>

      <div className="relative z-10 container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 min-h-screen flex flex-col items-center justify-center">
        {/* Header Section */}
        <div
          className={`flex flex-col w-full items-center justify-center gap-6 mb-24 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/15 to-indigo-600/15 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <pre className="relative overflow-hidden font-mono text-[10px] xs:text-xs sm:text-base md:text-lg leading-tight bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-7 w-full text-center shadow-2xl border border-white/20 dark:border-slate-700/40 text-slate-800 dark:text-slate-200 hover:scale-[1.02] transition-transform duration-300">
              {TITLE_TS_START}
            </pre>
          </div>

          <div className="relative group mb-12 sm:mb-16">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/15 to-purple-600/15 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
            <pre className="relative overflow-hidden font-mono text-[7px] xs:text-[9px] sm:text-[11px] md:text-sm leading-[1.2] bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl p-3 sm:p-4 md:p-5 w-full text-center shadow-2xl border border-white/20 dark:border-slate-700/40 text-slate-700 dark:text-slate-300 hover:scale-[1.02] transition-transform duration-300">
              {TITLE_CONVEX}
            </pre>
          </div>
        </div>

        

        
      </div>

      <style>{`
          @keyframes float {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(30px, -30px) rotate(120deg); }
            66% { transform: translate(-20px, 20px) rotate(240deg); }
          }
          
          @keyframes float-delayed {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(-30px, 30px) rotate(-120deg); }
            66% { transform: translate(20px, -20px) rotate(-240deg); }
          }
          
          @keyframes progress-wave {
            0% { width: 0%; transform: translateX(-100%); }
            50% { width: 100%; transform: translateX(0%); }
            100% { width: 100%; transform: translateX(100%); }
          }
          
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          
          @keyframes pulse-soft {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
          }
          
          .animate-float {
            animation: float 20s ease-in-out infinite;
          }
          
          .animate-float-delayed {
            animation: float-delayed 25s ease-in-out infinite;
          }
          
          .animate-progress-wave {
            animation: progress-wave 2s ease-in-out infinite;
          }
          
          .animate-shimmer {
            animation: shimmer 2s ease-in-out infinite;
          }
          
          .animate-pulse-soft {
            animation: pulse-soft 2s ease-in-out infinite;
          }
          
          .shadow-3xl {
            box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
          }
          
          @media (min-width: 480px) {
            .xs\\:text-xs {
              font-size: 0.75rem;
              line-height: 1rem;
            }
            .xs\\:text-\\[8px\\] {
              font-size: 8px;
            }
          }
          
          @media (max-width: 640px) {
            .container {
              padding-left: 1rem;
              padding-right: 1rem;
            }
          }
        `}</style>
    </div>
  );
}

export default HomeComponent;
