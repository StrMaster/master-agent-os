'use client';

import { useState } from 'react';

export default function StudioPage() {
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('nextjs');

  const handleCreate = async () => {
    // TODO: Implement project creation
    console.log('Creating project:', { projectName, projectType });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AI Studio</h1>
        
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-awesome-project"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Project Type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="nextjs">Next.js App</option>
                <option value="react">React App</option>
                <option value="node">Node.js API</option>
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={!projectName.trim()}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
