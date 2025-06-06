import React, { useState } from 'react';

const DemoTutorial: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'workflow' | 'features' | 'examples'>('overview');

  const PlayIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8a2 2 0 012-2z" />
    </svg>
  );

  const BookIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );

  const StarIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );

  const CheckIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  const sections = [
    { id: 'overview' as const, name: 'Overview', icon: <PlayIcon /> },
    { id: 'workflow' as const, name: 'Workflow', icon: <BookIcon /> },
    { id: 'features' as const, name: 'Features', icon: <StarIcon /> },
    { id: 'examples' as const, name: 'Examples', icon: <CheckIcon /> },
  ];

  return (
    <div className="h-full flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex-shrink-0">
        <div className="p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-6">Getting Started</h2>
          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${activeSection === section.id 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
              >
                <span className={`transition-transform duration-200 ${
                  activeSection === section.id ? 'scale-110' : ''
                }`}>
                  {section.icon}
                </span>
                <span className="font-medium">{section.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">Welcome to QuiC</h1>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                  Quality Control for SPIDA & Katapult Data - Your comprehensive tool for comparing and analyzing utility pole data
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-6 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Data Comparison</h3>
                  </div>
                  <p className="text-slate-300">
                    Compare SPIDA and Katapult JSON files to identify matches, mismatches, and discrepancies in your utility pole data.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-6 rounded-xl border border-blue-500/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Visual Analytics</h3>
                  </div>
                  <p className="text-slate-300">
                    View detailed statistics, geographic mapping, and comprehensive analytics of your pole data comparisons.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-6 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Data Editing</h3>
                  </div>
                  <p className="text-slate-300">
                    Edit and update pole data directly in the interface, with real-time validation and mismatch detection.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-cyan-500/10 to-teal-500/10 p-6 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Export Options</h3>
                  </div>
                  <p className="text-slate-300">
                    Export your results to CSV, updated SPIDA JSON, or Katapult attribute XLSX files for further processing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Section */}
          {activeSection === 'workflow' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">3-Step Workflow</h1>
                <p className="text-xl text-slate-300">Follow these simple steps to get started</p>
              </div>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg">
                      1
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-white mb-4">Load Your Data Files</h3>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-lg font-medium text-emerald-400 mb-2">SPIDA File</h4>
                          <ul className="space-y-2 text-slate-300">
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Upload your SPIDA JSON file</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Contains pole structure data</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Includes SCID and pole numbers</span>
                            </li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-cyan-400 mb-2">Katapult File</h4>
                          <ul className="space-y-2 text-slate-300">
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Upload your Katapult JSON file</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Contains engineering data</span>
                            </li>
                            <li className="flex items-center space-x-2">
                              <CheckIcon />
                              <span>Includes pole specifications</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg">
                      2
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-white mb-4">Run the Comparison</h3>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                      <div className="space-y-4">
                        <p className="text-slate-300">
                          Once both files are loaded, click the <span className="text-yellow-400 font-semibold">"Run Comparison"</span> button to start the analysis.
                        </p>
                        <div className="bg-slate-900/50 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-white mb-3">Matching Algorithm</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-slate-300"><strong>Tier 1:</strong> SCID Exact Match</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span className="text-slate-300"><strong>Tier 2:</strong> Pole Number Match</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <span className="text-slate-300"><strong>Tier 3:</strong> Coordinate Proximity</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                              <span className="text-slate-300"><strong>Tier 4:</strong> Fuzzy Matching</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg">
                      3
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-white mb-4">Review & Export Results</h3>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-slate-900/50 rounded-lg">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H9a2 2 0 012 2z" />
                            </svg>
                          </div>
                          <h4 className="font-medium text-white">CSV Export</h4>
                          <p className="text-sm text-slate-400 mt-1">Complete comparison data</p>
                        </div>
                        <div className="text-center p-4 bg-slate-900/50 rounded-lg">
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <h4 className="font-medium text-white">SPIDA JSON</h4>
                          <p className="text-sm text-slate-400 mt-1">Updated structure data</p>
                        </div>
                        <div className="text-center p-4 bg-slate-900/50 rounded-lg">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h4 className="font-medium text-white">Katapult XLSX</h4>
                          <p className="text-sm text-slate-400 mt-1">Attribute updates</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features Section */}
          {activeSection === 'features' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">Key Features</h1>
                <p className="text-xl text-slate-300">Discover what makes QuiC powerful</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Data Table Features */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-emerald-400">Data Table</h2>
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Interactive Editing</h3>
                      <p className="text-slate-300 text-sm">Edit pole specifications, percentages, and communication drop requirements directly in the table.</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Mismatch Highlighting</h3>
                      <p className="text-slate-300 text-sm">Automatically highlights differences between SPIDA and Katapult data with color coding.</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Detailed View</h3>
                      <p className="text-slate-300 text-sm">Click any row to see comprehensive pole details including coordinates and full specifications.</p>
                    </div>
                  </div>
                </div>

                {/* Map & Analytics Features */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-cyan-400">Map & Analytics</h2>
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Geographic Visualization</h3>
                      <p className="text-slate-300 text-sm">View pole locations on an interactive map with match quality indicators.</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Match Statistics</h3>
                      <p className="text-slate-300 text-sm">Comprehensive statistics showing match rates, tier distribution, and data quality metrics.</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-medium text-white mb-2">Quality Insights</h3>
                      <p className="text-slate-300 text-sm">Identify data quality issues and potential improvements in your datasets.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Features */}
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-xl p-6 border border-slate-600">
                <h2 className="text-2xl font-semibold text-white mb-6">Advanced Capabilities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Fast Processing</h3>
                      <p className="text-sm text-slate-400">Process thousands of poles in seconds</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Data Validation</h3>
                      <p className="text-sm text-slate-400">Built-in validation and error checking</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">User Friendly</h3>
                      <p className="text-sm text-slate-400">Intuitive interface with helpful guides</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Examples Section */}
          {activeSection === 'examples' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">Examples & Use Cases</h1>
                <p className="text-xl text-slate-300">See QuiC in action</p>
              </div>

              <div className="space-y-8">
                {/* Sample Data Formats */}
                <div>
                  <h2 className="text-2xl font-semibold text-emerald-400 mb-6">Sample Data Formats</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-white mb-3">SPIDA JSON Structure</h3>
                      <div className="bg-slate-900/70 rounded-lg p-4 border border-slate-700 text-sm">
                        <pre className="text-emerald-400 overflow-x-auto">
{`{
  "version": "1.0",
  "poles": [
    {
      "id": "12345",
      "scid": "SC001",
      "poleNumber": "P001", 
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "specification": "40CL5",
      "existingPercent": 85,
      "finalPercent": 92
    }
  ]
}`}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white mb-3">Katapult JSON Structure</h3>
                      <div className="bg-slate-900/70 rounded-lg p-4 border border-slate-700 text-sm">
                        <pre className="text-cyan-400 overflow-x-auto">
{`{
  "project": "Sample Project",
  "poles": [
    {
      "scid": "SC001",
      "poleTag": "P001",
      "location": [40.7128, -74.0060],
      "poleSpec": "40CL5-WOOD",
      "existingCapacity": 82,
      "finalCapacity": 90,
      "commDrop": "Yes"
    }
  ]
}`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Common Use Cases */}
                <div>
                  <h2 className="text-2xl font-semibold text-blue-400 mb-6">Common Use Cases</h2>
                  <div className="grid gap-6">
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">Quality Assurance</h3>
                          <p className="text-slate-300 mb-3">
                            Verify that engineering data from SPIDA matches the field survey data from Katapult to ensure accuracy before construction.
                          </p>
                          <div className="text-sm text-slate-400">
                            <strong>Typical workflow:</strong> Load both datasets → Run comparison → Review mismatches → Export corrected data
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-2">Data Reconciliation</h3>
                          <p className="text-slate-300 mb-3">
                            Identify and resolve discrepancies between field measurements and engineering calculations for pole capacities and specifications.
                          </p>
                          <div className="text-sm text-slate-400">
                            <strong>Common findings:</strong> Specification differences, capacity variations, missing communication drops
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Start Tips */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-6 border border-emerald-500/20">
                  <h2 className="text-2xl font-semibold text-white mb-4">Quick Start Tips</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-slate-300">Start with smaller datasets to familiarize yourself</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-slate-300">Review the Statistics tab for overall data quality</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className="text-slate-300">Use the Map view to identify geographic patterns</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        <span className="text-slate-300">Focus on red-highlighted mismatches first</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        <span className="text-slate-300">Export early and often to preserve your work</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        <span className="text-slate-300">Use the detail view for complex pole analysis</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoTutorial; 