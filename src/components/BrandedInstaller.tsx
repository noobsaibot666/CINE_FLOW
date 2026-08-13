import React from 'react';
import { motion } from 'framer-motion';
import { Download, ArrowRight, Folder, Apple } from 'lucide-react';
import dmgBackground from '../assets/dgm_bg.png';
import appIcon from '../assets/cineflow-app-icon.png';

interface BrandedInstallerProps {
  onEnterSuite?: () => void;
}

export const BrandedInstaller: React.FC<BrandedInstallerProps> = ({ onEnterSuite }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#08080a] text-white p-8 font-sans">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
          CineFlow Suite for macOS
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          The professional production to post hub is ready for installation. 
          Follow the simple steps below to get started.
        </p>
      </motion.div>

      {/* Mock DMG Window */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative w-full max-w-4xl aspect-[12/8] rounded-2xl overflow-hidden shadow-2xl shadow-cyan-900/20 border border-white/10"
      >
        {/* DMG Title Bar */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-white/5 backdrop-blur-md flex items-center px-4 z-10 border-b border-white/5">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 text-center text-xs text-gray-400 font-medium">
            CineFlow Suite Installer
          </div>
        </div>

        {/* DMG Content */}
        <div 
          className="w-full h-full bg-cover bg-center flex items-center justify-center relative"
          style={{ backgroundImage: `url(${dmgBackground})` }}
        >
          {/* Animated App Icon */}
          <motion.div
            animate={{ 
              x: [0, 320, 0], // Adjusted distance for 140 -> 460 range (approx 320px in mock scale)
              y: [0, 0, 0] 
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute left-[23.3%] top-[45%] flex flex-col items-center gap-3"
          >
            <div className="relative">
              <img src={appIcon} alt="CineFlow" className="w-24 h-24 shadow-2xl" />
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-2xl ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
              />
            </div>
            <span className="text-sm font-medium text-white shadow-black drop-shadow-md">CineFlow Suite</span>
          </motion.div>

          {/* Applications Folder Target Area */}
          <div className="absolute right-[23.3%] top-[45%] flex flex-col items-center gap-3">
             <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 flex items-center justify-center shadow-xl">
                <Folder className="w-12 h-12 text-cyan-400 opacity-80" />
             </div>
             <span className="text-sm font-medium text-white/80">Applications</span>
          </div>
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12 flex flex-col items-center gap-6"
      >
        <button className="group relative flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-cyan-400 transition-all duration-300 shadow-xl hover:shadow-cyan-400/20 active:scale-95">
          <Download className="w-5 h-5" />
          Download .DMG Installer
          <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:animate-ping" />
        </button>

        {onEnterSuite && (
          <button 
            onClick={onEnterSuite}
            className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors group"
          >
            Continue to App Suite
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
        
        <div className="flex items-center gap-8 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <Apple className="w-4 h-4" />
            macOS 12.0+
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Verified by Apple
          </div>
        </div>
      </motion.div>

      {/* Instructions */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        {[
          { step: "01", title: "Download", desc: "Get the latest CineFlow Suite DMG for Apple Silicon or Intel." },
          { step: "02", title: "Mount", desc: "Double-click the downloaded file to open the disk image." },
          { step: "03", title: "Install", desc: "Drag CineFlow Suite to your Applications folder and launch." }
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + (i * 0.1) }}
            className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-cyan-400 font-mono text-sm mb-2 block">{item.step}</span>
            <h3 className="text-xl font-bold mb-2">{item.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
