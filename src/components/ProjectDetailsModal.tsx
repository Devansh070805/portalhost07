'use client';

import {
  X,
  Calendar,
  ExternalLink,
  Github,
  ListChecks,
  FileText,
} from 'lucide-react';

// Define the shape of a single Test Case
interface TestCase {
  name: string;
  description: string;
}

// Define the shape of the Project, matching the dashboard page
interface Project {
  id: string;
  title: string;
  status: string;
  deployedLink?: string;
  githubLink?: string;
  submissionTime: any; // Firestore timestamp
  testCases?: TestCase[];
}

// Define the props for our modal
interface ProjectDetailsModalProps {
  project: Project;
  onClose: () => void;
}

export default function ProjectDetailsModal({
  project,
  onClose,
}: ProjectDetailsModalProps) {
  // --- Helper Functions from dashboard ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'TESTING':
        return 'bg-blue-100 text-blue-700';
      case 'ASSIGNED':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'TESTING':
        return 'Testing';
      case 'ASSIGNED':
        return 'Assigned';
      case 'PENDING':
        return 'Pending';
      default:
        return status;
    }
  };
  // --- End of Helper Functions ---

  return (
    // Backdrop
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
    >
      {/* Modal Content */}
      <div
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-2 border-gray-300 rounded-xl shadow-xl m-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b-2 border-gray-300 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-red-800" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {project.title}
              </h2>
              <p className="text-sm text-gray-500">Project Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* --- Status & Date --- */}
          <div className="flex flex-wrap gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                project.status
              )}`}
            >
              Status: {getStatusText(project.status)}
            </span>
            <span className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 bg-gray-100 border-2 border-gray-200 rounded-full">
              <Calendar className="w-4 h-4" />
              Submitted on{' '}
              {/* @ts-ignore */}
              {new Date(project.submissionTime?.toDate()).toLocaleDateString()}
            </span>
          </div>

          {/* --- Links --- */}
          <div className="flex flex-wrap gap-3">
            {project.deployedLink && (
              <a
                href={project.deployedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border-2 border-gray-300 rounded-lg hover:bg-gray-200"
              >
                <ExternalLink className="w-4 h-4" />
                View Live
              </a>
            )}
            {project.githubLink && (
              <a
                href={project.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border-2 border-gray-300 rounded-lg hover:bg-gray-200"
              >
                <Github className="w-4 h-4" />
                GitHub Repository
              </a>
            )}
          </div>

          {/* --- Test Cases --- */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3">
              <ListChecks className="w-5 h-5 text-red-800" />
              Submitted Test Cases
            </h3>
            {project.testCases && project.testCases.length > 0 ? (
              <ul className="space-y-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                {project.testCases.map((tc, index) => (
                  <li
                    key={index}
                    className="pb-3 border-b border-gray-200 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{tc.name}</p>
                    <p className="text-sm text-gray-600">{tc.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                No test cases were submitted with this project.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-300 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
