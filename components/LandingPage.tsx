import React, { useState, useEffect, useRef } from 'react';

interface LandingPageProps {
  onEnterApp: () => void;
}

interface Bolt {
  canvas: HTMLCanvasElement;
  duration: number;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showCallToAction, setShowCallToAction] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number>();
  
  // Lightning animation variables
  const boltsRef = useRef<Bolt[]>([]);
  const lastFrameRef = useRef<number>(Date.now());
  const flashOpacityRef = useRef<number>(0);
  const lastSparkTimeRef = useRef<number>(0);
  
  // Animation constants
  const totalBoltDuration = 0.2;
  const boltFadeDuration = 0.1;
  const boltWidth = 4.0;
  const boltWobble = 20.0;

  useEffect(() => {
    setIsVisible(true);
    
    // Show call-to-action after 3 seconds with pop-up animation
    const timer = setTimeout(() => {
      setShowCallToAction(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Lightning animation functions
  const setCanvasSize = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  };

  const createBoltCanvas = (startX: number, startY: number, length: number, angle: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d')!;
    
    const x = startX;
    let y = startY;
    
    context.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    context.lineWidth = boltWidth;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(100, 149, 237, 0.8)';
    context.shadowBlur = 10;
    
    context.beginPath();
    context.moveTo(x, y);
    
    const segments = Math.floor(length / 10);
    for (let i = 0; i < segments; i++) {
      const segmentLength = length / segments;
      const wobbleX = (Math.random() - 0.5) * boltWobble;
      const wobbleY = (Math.random() - 0.5) * boltWobble;
      
      y += segmentLength + wobbleY;
      context.lineTo(x + wobbleX, y);
    }
    
    context.stroke();
    
    // Add some branches
    if (Math.random() > 0.7) {
      const branchY = startY + Math.random() * length * 0.7;
      const branchLength = length * 0.3;
      const branchAngle = angle + (Math.random() - 0.5) * Math.PI / 4;
      
      context.beginPath();
      context.moveTo(x, branchY);
      context.lineTo(
        x + Math.cos(branchAngle) * branchLength,
        branchY + Math.sin(branchAngle) * branchLength
      );
      context.stroke();
    }
    
    return canvas;
  };

  const launchBolt = (x: number, y: number, length: number, angle: number) => {
    const boltCanvas = createBoltCanvas(x, y, length, angle);
    const bolt: Bolt = {
      canvas: boltCanvas,
      duration: 0
    };
    
    boltsRef.current.push(bolt);
    flashOpacityRef.current = 0.3;
  };

  const launchButtonSpark = (buttonElement: HTMLElement) => {
    const now = Date.now();
    // Throttle sparks to prevent too frequent triggering (500ms cooldown)
    if (now - lastSparkTimeRef.current < 500) {
      return;
    }
    lastSparkTimeRef.current = now;

    const rect = buttonElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Create multiple sparks radiating outward
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      const length = 80 + Math.random() * 120;
      
      const sparkCanvas = createSparkCanvas(centerX, centerY, length, angle);
      const bolt: Bolt = {
        canvas: sparkCanvas,
        duration: 0
      };
      
      boltsRef.current.push(bolt);
    }

    // Create one long spark to the left border
    const leftSparkLength = centerX + 50; // Reach past the left edge
    const leftSparkCanvas = createSparkCanvas(centerX, centerY, leftSparkLength, Math.PI); // Math.PI = 180 degrees (left)
    const leftBolt: Bolt = {
      canvas: leftSparkCanvas,
      duration: 0
    };
    boltsRef.current.push(leftBolt);

    // Create one long spark to the right border
    const rightSparkLength = (window.innerWidth - centerX) + 50; // Reach past the right edge
    const rightSparkCanvas = createSparkCanvas(centerX, centerY, rightSparkLength, 0); // 0 = 0 degrees (right)
    const rightBolt: Bolt = {
      canvas: rightSparkCanvas,
      duration: 0
    };
    boltsRef.current.push(rightBolt);

    // Note: Continuous border lightning is now handled in the main animation loop
    
    flashOpacityRef.current = 0.1; // Lighter flash for button sparks
  };

  const createSparkCanvas = (startX: number, startY: number, length: number, angle: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d')!;
    
    let x = startX;
    let y = startY;
    
    context.strokeStyle = 'rgba(255, 255, 100, 1.0)'; // More yellow for button sparks
    context.lineWidth = 2.0; // Thinner sparks
    context.lineCap = 'round';
    context.shadowColor = 'rgba(255, 215, 0, 0.8)';
    context.shadowBlur = 8;
    
    context.beginPath();
    context.moveTo(x, y);
    
    const segments = Math.floor(length / 8);
    for (let i = 0; i < segments; i++) {
      const segmentLength = length / segments;
      const wobbleX = (Math.random() - 0.5) * 8; // Less wobble for sparks
      const wobbleY = (Math.random() - 0.5) * 8;
      
      x += Math.cos(angle) * segmentLength + wobbleX;
      y += Math.sin(angle) * segmentLength + wobbleY;
      context.lineTo(x, y);
    }
    
    context.stroke();
    return canvas;
  };



  const createAnimatedBorderLightning = (time: number): HTMLCanvasElement | null => {
    if (!buttonRef.current || !showCallToAction) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d')!;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const padding = 8;
    
    // Make animation much faster and more visible
    const animationSpeed = 0.002; // Faster flow
    const timeOffset = time * animationSpeed;
    const intensity = 0.8 + 0.4 * Math.sin(time * 0.002); // More intense pulsing
    
    // Much more visible lightning
    context.strokeStyle = `rgba(255, 215, 0, ${intensity})`;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.shadowColor = `rgba(255, 215, 0, 1.0)`;
    context.shadowBlur = 15;
    
    // Simpler rectangular border for visibility
    const left = rect.left - padding;
    const right = rect.right + padding;
    const top = rect.top - padding;
    const bottom = rect.bottom + padding;
    const width = right - left;
    const height = bottom - top;
    
    // Create moving lightning segments
    const segmentCount = 40;
    const perimeter = 2 * (width + height);
    
    context.beginPath();
    
    for (let i = 0; i < segmentCount; i++) {
      const progress = (i / segmentCount + timeOffset) % 1;
      const distanceAlongPerimeter = progress * perimeter;
      
      let x, y;
      
      if (distanceAlongPerimeter < width) {
        // Top edge
        x = left + distanceAlongPerimeter;
        y = top;
      } else if (distanceAlongPerimeter < width + height) {
        // Right edge
        x = right;
        y = top + (distanceAlongPerimeter - width);
      } else if (distanceAlongPerimeter < 2 * width + height) {
        // Bottom edge
        x = right - (distanceAlongPerimeter - width - height);
        y = bottom;
      } else {
        // Left edge
        x = left;
        y = bottom - (distanceAlongPerimeter - 2 * width - height);
      }
      
      // Add dramatic lightning wobble
      const wobblePhase = progress * Math.PI * 6 + time * 0.01;
      const wobbleAmount = 8 * Math.sin(wobblePhase);
      
      // Apply wobble perpendicular to the edge
      if (distanceAlongPerimeter < width || (distanceAlongPerimeter >= 2 * width + height)) {
        // Top and bottom edges - wobble vertically
        y += wobbleAmount;
      } else {
        // Left and right edges - wobble horizontally
        x += wobbleAmount;
      }
      
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    
    context.closePath();
    context.stroke();
    
    return canvas;
  };

  const tick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d')!;
    const frame = Date.now();
    const elapsed = (frame - lastFrameRef.current) / 1000.0;
    lastFrameRef.current = frame;
    
    // Clear the canvas
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    // Fire a bolt every once in a while
    if (Math.random() > 0.9985) {
      const x = Math.floor(-10 + Math.random() * (window.innerWidth + 20));
      const y = 0; // Always start from the very top of the screen
      const length = Math.floor(window.innerHeight / 2 + Math.random() * (window.innerHeight / 2));
      
      launchBolt(x, y, length, Math.PI * 3 / 2);
    }
    
    // Draw the flash
    if (flashOpacityRef.current > 0) {
      context.fillStyle = `rgba(255, 255, 255, ${flashOpacityRef.current})`;
      context.fillRect(0, 0, window.innerWidth, window.innerHeight);
      flashOpacityRef.current = Math.max(0, flashOpacityRef.current - 2.0 * elapsed);
    }
    
    // Draw each bolt
    const bolts = boltsRef.current;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bolt = bolts[i];
      bolt.duration += elapsed;
      
      if (bolt.duration >= totalBoltDuration) {
        bolts.splice(i, 1);
        continue;
      }
      
      context.globalAlpha = Math.max(0, Math.min(1, (totalBoltDuration - bolt.duration) / boltFadeDuration));
      context.drawImage(bolt.canvas, 0, 0);
    }
    
    // Draw continuous animated border lightning
    context.globalAlpha = 1.0;
    const borderCanvas = createAnimatedBorderLightning(frame);
    if (borderCanvas) {
      context.drawImage(borderCanvas, 0, 0);
    }
    
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setCanvasSize();
    
    const handleResize = () => {
      setCanvasSize();
    };
    
    window.addEventListener('resize', handleResize);
    animationFrameRef.current = requestAnimationFrame(tick);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen animated-gradient-bg overflow-hidden relative">
      {/* Lightning canvas background */}
      <canvas 
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'transparent' }}
      />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
        <div className="absolute -top-1/2 -right-1/2 w-[800px] h-[800px] bg-gradient-to-br from-yellow-400/10 to-blue-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-full blur-3xl animate-gentle-bounce" />
      </div>

      <div className="relative z-20 flex flex-col min-h-screen">
        {/* Header */}
        <header className="text-center pt-16 pb-8">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="mb-4">
              <h1 className="text-8xl font-bold quic-white-flicker">
                QuiC
              </h1>
            </div>
            <p className="text-2xl text-slate-200 mb-4 animate-gentle-bounce" style={{
              filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
            }}>
              Quality Control for SPIDA & Katapult Data
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-6 pb-16">
          <div className="max-w-7xl mx-auto">
            
            {/* Interactive Timeline Flow */}
            <div className={`mb-16 py-16 mt-8 transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <h2 className="text-3xl font-bold text-slate-200 mb-16 text-center" style={{
                filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
              }}>Your Journey with QuiC</h2>
              
              {/* Timeline Container */}
              <div className="relative overflow-x-auto pb-32 px-4">
                <div className="flex items-center justify-center min-w-[1200px] space-x-8 px-8">
                  
                  {/* Step 1: Upload */}
                  <div className="group relative flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-400/25">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Upload Files</h3>
                                         <p className="text-sm text-slate-400 text-center max-w-32">Load SPIDA & Katapult JSON</p>
                     
                     {/* Feature Popup */}
                     <div className="absolute top-full mt-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-10">
                       <div className="bg-slate-800/95 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 w-64 shadow-xl">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h4 className="font-semibold text-white">Smart Data Parsing</h4>
                        </div>
                        <p className="text-sm text-slate-300">Intelligent file validation and structure analysis with automatic error detection</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow 1 */}
                  <div className="flex items-center">
                    <div className="w-16 h-0.5 bg-gradient-to-r from-blue-400 to-yellow-400"></div>
                    <svg className="w-6 h-6 text-yellow-400 -ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6l-6 6l-1.41-1.41z"/>
                    </svg>
                  </div>

                  {/* Step 2: Analyze */}
                  <div className="group relative flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-2xl border border-yellow-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-yellow-400/25">
                      <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Analyze</h3>
                                         <p className="text-sm text-slate-400 text-center max-w-32">Run intelligent comparison</p>
                     
                     {/* Feature Popup */}
                     <div className="absolute top-full mt-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-10">
                       <div className="bg-slate-800/95 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-4 w-64 shadow-xl">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                          </div>
                          <h4 className="font-semibold text-white">Visual Analytics</h4>
                        </div>
                        <p className="text-sm text-slate-300">Interactive maps, detailed statistics, and comprehensive data insights</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow 2 */}
                  <div className="flex items-center">
                    <div className="w-16 h-0.5 bg-gradient-to-r from-yellow-400 to-purple-400"></div>
                    <svg className="w-6 h-6 text-purple-400 -ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6l-6 6l-1.41-1.41z"/>
                    </svg>
                  </div>

                  {/* Step 3: Edit & Refine */}
                  <div className="group relative flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl border border-purple-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-purple-400/25">
                      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Edit & Refine</h3>
                                         <p className="text-sm text-slate-400 text-center max-w-32">Correct data discrepancies</p>
                     
                     {/* Feature Popup */}
                     <div className="absolute top-full mt-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-10">
                       <div className="bg-slate-800/95 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 w-64 shadow-xl">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <h4 className="font-semibold text-white">Data Editing</h4>
                        </div>
                        <p className="text-sm text-slate-300">Edit pole specifications directly with real-time validation and conflict resolution</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow 3 */}
                  <div className="flex items-center">
                    <div className="w-16 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400"></div>
                    <svg className="w-6 h-6 text-cyan-400 -ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6l-6 6l-1.41-1.41z"/>
                    </svg>
                  </div>

                  {/* Step 4: Export */}
                  <div className="group relative flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-2xl border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-cyan-400/25">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Export</h3>
                                         <p className="text-sm text-slate-400 text-center max-w-32">Get results in your format</p>
                     
                     {/* Feature Popup */}
                     <div className="absolute top-full mt-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto z-10">
                       <div className="bg-slate-800/95 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-4 w-64 shadow-xl">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h4 className="font-semibold text-white">Export Options</h4>
                        </div>
                        <p className="text-sm text-slate-300">Export to CSV, updated SPIDA JSON, or Katapult XLSX formats with custom formatting</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Timeline instruction */}
                <div className="text-center mt-12 mb-8">
                  <p className="text-slate-400 text-sm">Hover over each step to see detailed features</p>
                </div>
              </div>
            </div>

            {/* Call to action */}
            {showCallToAction && (
              <div className="text-center animate-pop-up-spin">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold text-slate-200 mb-4" style={{
                  filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
                }}>Ready to Get Started?</h2>
                <p className="text-xl text-slate-200 mb-8 max-w-2xl mx-auto" style={{
                  filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
                }}>
                  Transform your utility pole data analysis workflow with QuiC's powerful comparison and visualization tools.
                </p>
                
                                  <div className="group relative">
                    <button
                      ref={buttonRef}
                      onClick={onEnterApp}
                      onMouseEnter={() => {
                        if (buttonRef.current) {
                          launchButtonSpark(buttonRef.current);
                        }
                      }}
                      className="relative inline-flex items-center space-x-3 px-12 py-4 solid-yellow-glow rounded-full text-slate-900 font-bold text-lg shadow-lg shadow-yellow-400/25 hover:shadow-xl hover:shadow-yellow-400/40 transform hover:scale-105 transition-all duration-300 animate-float"
                    >
                      <span>Enter QuiC Dashboard</span>
                      <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                
                <div className="flex items-center justify-center space-x-8 text-sm text-slate-200 mt-8" style={{
                  filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
                }}>
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
            )}
          </div>
        </main>


      </div>
    </div>
  );
};

export default LandingPage; 