import React, { useState, useEffect } from 'react';

interface LandingPageProps {
  onEnterApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Cycle through features every 7 seconds (slowed down further)
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % 4);
    }, 7000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "Data Comparison",
      description: "Compare SPIDA and Katapult JSON files with intelligent matching algorithms",
      color: "emerald"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: "Visual Analytics",
      description: "Interactive maps, detailed statistics, and comprehensive data insights",
      color: "blue"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      title: "Data Editing",
      description: "Edit pole specifications directly with real-time validation",
      color: "yellow"
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Export Options",
      description: "Export to CSV, updated SPIDA JSON, or Katapult XLSX formats",
      color: "cyan"
    }
  ];

  const steps = [
    { number: "01", title: "Load Files", desc: "Upload SPIDA & Katapult JSON" },
    { number: "02", title: "Analyze", desc: "Run intelligent comparison" },
    { number: "03", title: "Export", desc: "Get results in your format" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[800px] h-[800px] bg-gradient-to-br from-yellow-400/10 to-blue-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-full blur-3xl animate-gentle-bounce" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="text-center pt-16 pb-8">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="inline-flex items-center space-x-4 mb-4">
              <img 
                src="/logo.svg" 
                alt="QuiC Logo" 
                className="w-16 h-16 animate-heartbeat"
              />
              <h1 className="text-6xl font-bold text-white animate-shimmer">
                QuiC
              </h1>
            </div>
            <p className="text-2xl text-slate-300 mb-4 animate-gentle-bounce">
              Quality Control for SPIDA & Katapult Data
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-6 pb-16">
          <div className="max-w-7xl mx-auto">
            
            {/* Features showcase */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              
              {/* Feature carousel */}
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-white mb-8">Features</h2>
                
                <div className="relative h-64 bg-gradient-to-br from-slate-800/50 to-slate-700/50 rounded-2xl border border-slate-600/50 overflow-hidden">
                  {features.map((feature, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 p-8 pb-16 transition-all duration-700 ease-in-out transform ${
                        currentFeature === index 
                          ? 'translate-x-0 opacity-100' 
                          : index > currentFeature 
                            ? 'translate-x-full opacity-0' 
                            : '-translate-x-full opacity-0'
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 animate-wiggle ${
                        feature.color === 'emerald' ? 'bg-emerald-500/20' :
                        feature.color === 'blue' ? 'bg-blue-500/20' :
                        feature.color === 'yellow' ? 'bg-yellow-500/20' :
                        feature.color === 'cyan' ? 'bg-cyan-500/20' : 'bg-slate-500/20'
                      }`}>
                        <div className={`${
                          feature.color === 'emerald' ? 'text-emerald-400' :
                          feature.color === 'blue' ? 'text-blue-400' :
                          feature.color === 'yellow' ? 'text-yellow-400' :
                          feature.color === 'cyan' ? 'text-cyan-400' : 'text-slate-400'
                        }`}>
                          {feature.icon}
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                      <p className="text-slate-300 text-lg leading-relaxed">{feature.description}</p>
                    </div>
                  ))}
                  
                  {/* Feature indicators */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-3">
                    {features.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentFeature(index)}
                        className={`w-3 h-3 rounded-full transition-all duration-500 ease-in-out ${
                          currentFeature === index 
                            ? 'bg-yellow-400 scale-125' 
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Process steps */}
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-white mb-8">Simple Process</h2>
                
                <div className="space-y-6">
                  {steps.map((step, index) => (
                    <div 
                      key={index}
                      className={`flex items-center space-x-6 p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl border border-slate-600/50 hover:border-yellow-400/50 transition-all duration-300 hover:scale-105 animate-float`}
                      style={{ animationDelay: `${index * 0.5}s` }}
                    >
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-blue-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg animate-heartbeat">
                        {step.number}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-1">{step.title}</h3>
                        <p className="text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Call to action */}
            <div className={`text-center transform transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="space-y-6">
                <h2 className="text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
                <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                  Transform your utility pole data analysis workflow with QuiC's powerful comparison and visualization tools.
                </p>
                
                <button
                  onClick={onEnterApp}
                  className="group relative inline-flex items-center space-x-3 px-12 py-4 bg-gradient-to-r from-yellow-400 to-blue-500 rounded-full text-white font-bold text-lg shadow-lg shadow-yellow-400/25 hover:shadow-xl hover:shadow-yellow-400/40 transform hover:scale-105 transition-all duration-300 animate-float"
                >
                  <span>Enter QuiC Dashboard</span>
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                </button>
                
                <div className="flex items-center justify-center space-x-8 text-sm text-slate-400 mt-8">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span>No installation required</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span>Browser-based tool</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span>Secure & private</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-slate-800">
          <div className={`text-slate-500 text-sm transform transition-all duration-1000 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            QuiC by TechServ &copy; {new Date().getFullYear()} • Professional Utility Data Quality Control
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage; 