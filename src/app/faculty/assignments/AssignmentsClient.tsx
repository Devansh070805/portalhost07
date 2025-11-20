// src/app/faculty/assignments/AssignmentsClient.tsx
'use client'

import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Users, Check, X, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';

import {
  replaceProjectAssignments,
} from '../../../../services/assignments';

// import {
//   getAllProjectsForFaculty,          // ✅ UNCOMMENT
// } from '../../../../services/projects';

// import {
//   getAllTeamsForFaculty,             // ✅ UNCOMMENT
// } from '../../../../services/teams';

// ------------------ TYPES ------------------

interface ProjectAssignment {
  id?: string; // from assignments collection
  assignedTo: { id: string; name: string };
  isProposed?: boolean; // local-only for UI proposes
  status?: string; // "ASSIGNED", etc. from DB
}

interface Project {
  id: string;
  title: string;
  status: string;
  team: {
    id: string | null;
    name: string;
    subgroup: { name: string };
  };
  testAssignments?: ProjectAssignment[];
  deployedLink?: string;
  githubLink?: string;
}

interface Team {
  id: string;
  name: string;
  subgroup: { name: string };
}

// Props from server component
interface AssignmentsClientProps {
  initialProjects: Project[];
  initialTeams: Team[];
  initialUserName: string;
  userEmail: string;
}

// ------------------ HELPERS ------------------

// Compute current load per team (confirmed + proposed) with optional exclusion
const computeTeamLoadMap = (
  projects: Project[],
  projectIdToExclude?: string | null
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const p of projects) {
    if (projectIdToExclude && p.id === projectIdToExclude) continue;
    if (!p.testAssignments) continue;
    for (const a of p.testAssignments) {
      if (!a.assignedTo?.id) continue;
      const id = a.assignedTo.id;
      counts[id] = (counts[id] || 0) + 1;
    }
  }
  return counts;
};

// Get load for a single team from map
const getTeamLoadFromMap = (
  teamId: string,
  loadMap: Record<string, number>
): number => {
  return loadMap[teamId] || 0;
};

// Pure utility: random element from array
const pickRandom = <T,>(arr: T[]): T | null => {
  if (!arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
};

// Given list of candidate teams & load map, pick one with MIN load (< 2), random among min
const pickBestTeamByLoad = (
  candidates: Team[],
  loadMap: Record<string, number>,
  maxLoad: number
): Team | null => {
  const filtered = candidates.filter((t) => getTeamLoadFromMap(t.id, loadMap) < maxLoad);
  if (!filtered.length) return null;

  let minLoad = Infinity;
  filtered.forEach((t) => {
    const load = getTeamLoadFromMap(t.id, loadMap);
    if (load < minLoad) minLoad = load;
  });

  const best = filtered.filter(
    (t) => getTeamLoadFromMap(t.id, loadMap) === minLoad
  );
  return pickRandom(best);
};

// Select teams for ONE project according to your rules:
// - Hard no: can't assign same team as uploader
// - Prefer different subgroups
//   - project subgroup = A
//   - team1 → subgroup != A, best load
//   - team2 → prefer subgroup not A and not subgroup(team1)
//   - fallback steps allow more relaxation if necessary
const pickTwoTestingTeamsForProject = (
  project: Project,
  allTeams: Team[],
  loadMap: Record<string, number>,
  maxLoad: number
): { team1: Team | null; team2: Team | null; updatedLoadMap: Record<string, number> } => {
  const uploaderTeamId = project.team.id;
  const projectSubgroup = project.team.subgroup.name;

  // Always work on a copy so we don't mutate caller's map
  const localLoadMap: Record<string, number> = { ...loadMap };

  const baseCandidateFilter = (t: Team) =>
    t.id !== uploaderTeamId && getTeamLoadFromMap(t.id, localLoadMap) < maxLoad;

  // ---- TEAM 1 ----
  const candidatesTeam1Pref = allTeams.filter(
    (t) => baseCandidateFilter(t) && t.subgroup.name !== projectSubgroup
  );
  let team1 = pickBestTeamByLoad(candidatesTeam1Pref, localLoadMap, maxLoad);

  if (!team1) {
    const candidatesTeam1Fallback = allTeams.filter(baseCandidateFilter);
    team1 = pickBestTeamByLoad(candidatesTeam1Fallback, localLoadMap, maxLoad);
  }

  if (!team1) {
    // No slots anywhere
    return { team1: null, team2: null, updatedLoadMap: localLoadMap };
  }

  // Apply load for team1
  localLoadMap[team1.id] = getTeamLoadFromMap(team1.id, localLoadMap) + 1;

  // ---- TEAM 2 ----
  const baseCandidateFilter2 = (t: Team) =>
    t.id !== uploaderTeamId &&
    t.id !== team1!.id &&
    getTeamLoadFromMap(t.id, localLoadMap) < maxLoad;

  const team1Subgroup = team1.subgroup.name;

  // 1) Prefer subgroups neither A (project) nor team1 subgroup
  let candidatesTeam2 = allTeams.filter(
    (t) =>
      baseCandidateFilter2(t) &&
      t.subgroup.name !== projectSubgroup &&
      t.subgroup.name !== team1Subgroup
  );
  let team2 = pickBestTeamByLoad(candidatesTeam2, localLoadMap, maxLoad);

  // 2) If none, allow same subgroup as team1, but still avoid project subgroup
  if (!team2) {
    candidatesTeam2 = allTeams.filter(
      (t) =>
        baseCandidateFilter2(t) &&
        t.subgroup.name !== projectSubgroup
    );
    team2 = pickBestTeamByLoad(candidatesTeam2, localLoadMap, maxLoad);
  }

  // 3) As absolute LAST resort, allow project subgroup (but never uploader team)
  if (!team2) {
    candidatesTeam2 = allTeams.filter(baseCandidateFilter2);
    team2 = pickBestTeamByLoad(candidatesTeam2, localLoadMap, maxLoad);
  }

  if (!team2) {
    // Could only find one team in total
    return { team1, team2: null, updatedLoadMap: localLoadMap };
  }

  localLoadMap[team2.id] = getTeamLoadFromMap(team2.id, localLoadMap) + 1;

  return { team1, team2, updatedLoadMap: localLoadMap };
};

// ------------------ COMPONENT ------------------

export default function AssignmentsClient({
  initialProjects,
  initialTeams,
  initialUserName,
  userEmail,
}: AssignmentsClientProps) {

  const router = useRouter();          

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [userName, setUserName] = useState(initialUserName);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [loading, setLoading] = useState(false);
  const [hasProposedChanges, setHasProposedChanges] = useState(false);

  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTeam1, setSelectedTeam1] = useState<string>('');
  const [selectedTeam2, setSelectedTeam2] = useState<string>('');

  // Reassign modal state
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [projectToReassign, setProjectToReassign] = useState<Project | null>(
    null
  );
  const [reassignTeam1, setReassignTeam1] = useState<string>('');
  const [reassignTeam2, setReassignTeam2] = useState<string>('');

  useEffect(() => {
  setProjects(initialProjects);
}, [initialProjects]);

useEffect(() => {
  setTeams(initialTeams);
}, [initialTeams]);


  // Refresh from server (optional)
 const refreshData = async () => {
  setLoading(true);
  setHasProposedChanges(false);
  

  router.refresh(); // triggers server to refetch and re-render

  // Let the new props flow in; loading will be cleared in a short while
  setTimeout(() => {
    setLoading(false);
  }, 800);
};


  // ---------- DERIVED STATS & FILTERS ----------

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.team.name.toLowerCase().includes(searchTerm.toLowerCase());

    const hasAssignments =
      project.testAssignments && project.testAssignments.length > 0;

    const isProposed =
      hasAssignments && project.testAssignments![0].isProposed === true;
    const isConfirmed = hasAssignments && !isProposed;

    const matchesStatus =
      filterStatus === 'All Status' ||
      (filterStatus === 'Assigned' && isConfirmed) ||
      (filterStatus === 'Unassigned' && !hasAssignments) ||
      (filterStatus === 'Proposed' && isProposed);

    return matchesSearch && matchesStatus;
  });

  const totalProjects = projects.length;
  const assignedProjects = projects.filter(
    (p) =>
      p.testAssignments &&
      p.testAssignments.length > 0 &&
      !p.testAssignments[0].isProposed
  ).length;
  const proposedProjects = projects.filter(
    (p) =>
      p.testAssignments &&
      p.testAssignments.length > 0 &&
      p.testAssignments[0].isProposed === true
  ).length;
  const unassignedProjects = totalProjects - assignedProjects - proposedProjects;

  const unassignedProjectsList = projects.filter(
    (p) => !p.testAssignments || p.testAssignments.length === 0
  );
  const availableTeams = teams;

  // ---------- RANDOM ASSIGNMENT (MAIN BUTTON) ----------

  const handleRandomAssignment = () => {
    if (hasProposedChanges) {
      alert(
        'Please confirm or cancel existing proposals before generating new ones.'
      );
      return;
    }

    const projectsToAssign = projects.filter(
      (p) => !p.testAssignments || p.testAssignments.length === 0
    );

    if (projectsToAssign.length === 0) {
      alert('No unassigned projects to assign.');
      return;
    }

    if (teams.length < 3) {
      alert(
        'At least 3 teams are recommended for good distribution. Attempting assignment anyway.'
      );
    }

    // Seed load map from ALL current assignments (confirmed)
    let loadMap = computeTeamLoadMap(projects, null);
    const updatedProjects: Project[] = projects.map((p) => ({
      ...p,
      testAssignments: p.testAssignments ? [...p.testAssignments] : undefined,
    }));

    let successCount = 0;
    let partialCount = 0;
    let failedCount = 0;

    for (const project of projectsToAssign) {
      const projectIndex = updatedProjects.findIndex((p) => p.id === project.id);
      if (projectIndex === -1) continue;

      const { team1, team2, updatedLoadMap } = pickTwoTestingTeamsForProject(
        project,
        teams,
        loadMap,
        2
      );

      if (!team1 && !team2) {
        failedCount++;
        continue;
      }

      loadMap = updatedLoadMap;

      const newAssignments: ProjectAssignment[] = [];
      if (team1) {
        newAssignments.push({
          assignedTo: { id: team1.id, name: team1.name },
          isProposed: true,
        });
      }
      if (team2) {
        newAssignments.push({
          assignedTo: { id: team2.id, name: team2.name },
          isProposed: true,
        });
      }

      updatedProjects[projectIndex] = {
        ...updatedProjects[projectIndex],
        testAssignments: newAssignments,
      };

      if (team1 && team2) successCount++;
      else partialCount++;
    }

    setProjects(updatedProjects);
    if (successCount > 0 || partialCount > 0) {
      setHasProposedChanges(true);
    }

    alert(
      `Random assignment complete.\n\n` +
        `Fully assigned (2 teams): ${successCount}\n` +
        `Partially assigned (1 team): ${partialCount}\n` +
        `Failed (no available teams): ${failedCount}\n\n` +
        `Review proposals before confirming.`
    );
  };

  // ---------- CONFIRM / CANCEL PROPOSALS ----------

  const handleConfirmAllAssignments = async () => {
    setLoading(true);
    const projectsToConfirm = projects.filter((p) =>
      p.testAssignments?.some((a) => a.isProposed)
    );

    const projectPromises = projectsToConfirm.map((p) => {
      const newAssignments =
        p.testAssignments?.map((a) => ({
          teamId: a.assignedTo.id,
          teamName: a.assignedTo.name,
        })) || [];
      return replaceProjectAssignments(p.id, newAssignments);
    });

    try {
      const results = await Promise.all(projectPromises);
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      alert(
        `Successfully confirmed assignments for ${successCount} projects.` +
          (failedCount > 0
            ? `\n${failedCount} projects failed. Check console for details.`
            : '')
      );
    } catch (err) {
      console.error('Error confirming assignments: ', err);
      alert('An error occurred while confirming assignments.');
    } finally {
      await refreshData();
    }
  };

  const handleCancelChanges = () => {
    // Just refetch from server
    refreshData();
  };

  // ---------- CHANGE (REROLL) FOR SINGLE PROPOSED PROJECT ----------

  const handleRerollProposedProject = (projectId: string) => {
    const targetProject = projects.find((p) => p.id === projectId);
    if (!targetProject) return;

    // Load map: count all other assignments (confirmed + proposed), EXCLUDING this project
    let loadMap = computeTeamLoadMap(projects, projectId);

    const { team1, team2, updatedLoadMap } = pickTwoTestingTeamsForProject(
      targetProject,
      teams,
      loadMap,
      2
    );
    loadMap = updatedLoadMap;

    if (!team1 && !team2) {
      alert('No available teams with capacity to reassign this project.');
      return;
    }

    const newAssignments: ProjectAssignment[] = [];
    if (team1) {
      newAssignments.push({
        assignedTo: { id: team1.id, name: team1.name },
        isProposed: true,
      });
    }
    if (team2) {
      newAssignments.push({
        assignedTo: { id: team2.id, name: team2.name },
        isProposed: true,
      });
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, testAssignments: newAssignments }
          : p
      )
    );
    setHasProposedChanges(true);
  };

  // ---------- MANUAL ASSIGN (UNASSIGNED PROJECTS) ----------

  const handleManualAssign = async () => {
    if (!selectedProject || !selectedTeam1 || !selectedTeam2) {
      alert('Please select a project and two different teams.');
      return;
    }

    if (selectedTeam1 === selectedTeam2) {
      alert('Please select two different teams.');
      return;
    }

    const project = projects.find((p) => p.id === selectedProject);
    if (!project) {
      alert('Project not found.');
      return;
    }

    if (
      project.team.id === selectedTeam1 ||
      project.team.id === selectedTeam2
    ) {
      alert('A team cannot test its own project.');
      return;
    }

    const team1Obj = teams.find((t) => t.id === selectedTeam1);
    const team2Obj = teams.find((t) => t.id === selectedTeam2);

    if (!team1Obj || !team2Obj) {
      alert('Could not find selected teams. Please refresh.');
      return;
    }

    // Load map from all projects (exclude this project)
    const loadMap = computeTeamLoadMap(projects, selectedProject);
    const load1 = getTeamLoadFromMap(selectedTeam1, loadMap);
    const load2 = getTeamLoadFromMap(selectedTeam2, loadMap);

    if (load1 >= 2) {
      alert(
        `Assignment failed: Team 1 (${team1Obj.name}) is already at its 2-project limit.`
      );
      return;
    }
    if (load2 >= 2) {
      alert(
        `Assignment failed: Team 2 (${team2Obj.name}) is already at its 2-project limit.`
      );
      return;
    }

    setLoading(true);
    try {
      const newAssignments = [
        { teamId: selectedTeam1, teamName: team1Obj.name },
        { teamId: selectedTeam2, teamName: team2Obj.name },
      ];

      const result = await replaceProjectAssignments(
        selectedProject,
        newAssignments
      );

      // @ts-ignore
      if (result.success) {
        alert('Project assigned to both teams successfully!');
        await refreshData();
        setSelectedProject('');
        setSelectedTeam1('');
        setSelectedTeam2('');
      } else {
        // @ts-ignore
        alert(`Assignment failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during assignment.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- REASSIGN MODAL (CONFIRMED PROJECTS) ----------

  const openReassignModal = (project: Project) => {
    if (hasProposedChanges) {
      alert(
        'Please confirm or cancel pending proposals before reassigning a confirmed project.'
      );
      return;
    }
    setProjectToReassign(project);
    setReassignTeam1(project.testAssignments?.[0]?.assignedTo.id || '');
    setReassignTeam2(project.testAssignments?.[1]?.assignedTo.id || '');
    setIsReassignModalOpen(true);
  };

  const closeReassignModal = () => {
    setIsReassignModalOpen(false);
    setProjectToReassign(null);
    setReassignTeam1('');
    setReassignTeam2('');
  };

  const handleConfirmReassignment = async () => {
    if (!projectToReassign) return;

    if (
      reassignTeam1 &&
      reassignTeam1 !== 'NONE' &&
      reassignTeam1 === reassignTeam2
    ) {
      alert('You cannot assign the same team twice.');
      return;
    }

    if (
      reassignTeam1 === projectToReassign.team.id ||
      reassignTeam2 === projectToReassign.team.id
    ) {
      alert('A team cannot test its own project.');
      return;
    }

    setLoading(true);
    const newAssignments: { teamId: string; teamName: string }[] = [];

    try {
      const loadMap = computeTeamLoadMap(projects, projectToReassign.id);

      if (reassignTeam1 && reassignTeam1 !== 'NONE') {
        const t1 = teams.find((t) => t.id === reassignTeam1);
        if (!t1) throw new Error('Could not find Team 1.');
        const load1 = getTeamLoadFromMap(reassignTeam1, loadMap);
        if (load1 >= 2) {
          throw new Error(
            `Assignment failed: Team 1 (${t1.name}) is already at its 2-project limit.`
          );
        }
        newAssignments.push({ teamId: t1.id, teamName: t1.name });
        loadMap[t1.id] = load1 + 1;
      }

      if (reassignTeam2 && reassignTeam2 !== 'NONE') {
        const t2 = teams.find((t) => t.id === reassignTeam2);
        if (!t2) throw new Error('Could not find Team 2.');
        const load2 = getTeamLoadFromMap(reassignTeam2, loadMap);
        if (load2 >= 2) {
          throw new Error(
            `Assignment failed: Team 2 (${t2.name}) is already at its 2-project limit.`
          );
        }
        newAssignments.push({ teamId: t2.id, teamName: t2.name });
      }

      let confirmMessage = '';
      if (newAssignments.length === 0) {
        confirmMessage =
          "Are you sure you want to clear all assignments? This will make the project 'Unassigned'.";
      } else if (newAssignments.length === 1) {
        confirmMessage = `Are you sure you want to assign this project to only one team (${newAssignments[0].teamName})?`;
      } else {
        confirmMessage = `Are you sure you want to assign this project to ${newAssignments[0].teamName} and ${newAssignments[1].teamName}?`;
      }

      if (!confirm(confirmMessage)) {
        setLoading(false);
        return;
      }

      const result = await replaceProjectAssignments(
        projectToReassign.id,
        newAssignments
      );

      // @ts-ignore
      if (result.success) {
        alert('Project reassigned successfully!');
        closeReassignModal();
        await refreshData();
      } else {
        // @ts-ignore
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Error during reassignment: ', err);
      alert(`Reassignment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------- RENDER ----------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Project Assignments" userRole={userName} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6">
          <Link
            href="/faculty/dashboard"
            className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Overview
          </Link>
          <Link
            href="/faculty/assignments"
            className="px-4 py-2 bg-red-800 text-white rounded-lg font-medium"
          >
            Assignments
          </Link>
          <Link
            href="/faculty/subgroups"
            className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Subgroups
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 mb-1 font-medium">Total Projects</h3>
            <p className="text-4xl font-bold text-red-800">{totalProjects}</p>
          </div>
          <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 mb-1 font-medium">Assigned</h3>
            <p className="text-4xl font-bold text-green-600">
              {assignedProjects}
            </p>
          </div>
          <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-600 mb-1 font-medium">Unassigned</h3>
            <p className="text-4xl font-bold text-yellow-600">
              {unassignedProjects}
            </p>
          </div>
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 shadow-sm">
            <h3 className="text-blue-700 mb-1 font-medium">Proposed</h3>
            <p className="text-4xl font-bold text-blue-600">
              {proposedProjects}
            </p>
          </div>
        </div>

        {/* Quick Assignment Actions */}
        <div className="bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Quick Assignment Actions
          </h2>

          <button
            onClick={handleRandomAssignment}
            disabled={loading || hasProposedChanges}
            className="w-full py-4 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Users className="w-5 h-5" />
            Propose Random Assignments
          </button>

          <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Random assignment prioritizes different
              subgroups and teams with fewer projects. Teams never exceed{' '}
              <strong>2 projects</strong>, and the uploading team is never
              selected as a tester.
            </p>
          </div>
        </div>

        {/* Confirmation Bar */}
        {hasProposedChanges && (
          <div className="bg-white border-2 border-blue-400 rounded-xl p-6 shadow-lg mb-6 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-blue-800">
                Review Proposals
              </h3>
              <p className="text-gray-700 mt-1">
                You have {proposedProjects} unconfirmed assignment(s). Review
                them below, then confirm or cancel.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmAllAssignments}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                {loading ? 'Confirming...' : 'Confirm All'}
              </button>
              <button
                onClick={handleCancelChanges}
                disabled={loading}
                className="px-6 py-3 bg-gray-100 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
                Cancel Changes
              </button>
            </div>
          </div>
        )}

        {/* Assignment Management Table */}
        <div className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              Project Assignment Management
            </h2>
            <div className="flex gap-3 text-gray-800">
              <input
                type="text"
                placeholder="Search projects"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 bg-gray-50 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-red-800"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-gray-50 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-red-800"
              >
                <option>All Status</option>
                <option>Assigned</option>
                <option>Unassigned</option>
                <option>Proposed</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-200 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Project
                  </th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Team
                  </th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Subgroup
                  </th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Assigned To
                  </th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const hasAssignments =
                    project.testAssignments &&
                    project.testAssignments.length > 0;
                  const isProposed =
                    hasAssignments &&
                    project.testAssignments![0].isProposed === true;
                  const isConfirmed = hasAssignments && !isProposed;

                  return (
                    <tr
                      key={project.id}
                      className={`border-b border-gray-300 ${
                        isProposed ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 text-gray-800 font-medium">
                        {project.title}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {project.team.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          {project.team.subgroup.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {hasAssignments
                          ? project.testAssignments!
                              .map((a) => a.assignedTo.name)
                              .join(', ')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isProposed
                              ? 'bg-blue-100 text-blue-700'
                              : isConfirmed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {isProposed
                            ? 'Proposed'
                            : isConfirmed
                            ? 'Assigned'
                            : 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isProposed ? (
                          <button
                            onClick={() =>
                              handleRerollProposedProject(project.id)
                            }
                            className="px-4 py-2 bg-white border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Change
                          </button>
                        ) : isConfirmed ? (
                          <button
                            onClick={() => openReassignModal(project)}
                            disabled={hasProposedChanges}
                            className="px-4 py-2 bg-white border-2 border-gray-400 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reassign
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-100 border-2 border-gray-300 text-gray-400 rounded-lg text-sm font-medium disabled:opacity-60"
                          >
                            Assign Team
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual Assignment */}
        <div className="mt-6 bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Manual Assignment (for Unassigned Projects)
          </h2>
          {hasProposedChanges && (
            <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Please confirm or cancel your pending
                proposals before making a new manual assignment.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-700 mb-2 font-medium text-sm">
                Select Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                disabled={hasProposedChanges}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 disabled:opacity-50"
              >
                <option value="">Select unassigned project...</option>
                {unassignedProjectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} - {p.team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2 font-medium text-sm">
                Assign To Team 1
              </label>
              <select
                value={selectedTeam1}
                onChange={(e) => setSelectedTeam1(e.target.value)}
                disabled={hasProposedChanges || !selectedProject}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 disabled:opacity-50"
              >
                <option value="">Select testing team 1...</option>
                {availableTeams
                  .filter(
                    (t) =>
                      t.id !==
                      projects.find((p) => p.id === selectedProject)?.team.id
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Group {t.subgroup.name})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2 font-medium text-sm">
                Assign To Team 2
              </label>
              <select
                value={selectedTeam2}
                onChange={(e) => setSelectedTeam2(e.target.value)}
                disabled={
                  hasProposedChanges || !selectedProject || !selectedTeam1
                }
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 disabled:opacity-50"
              >
                <option value="">Select testing team 2...</option>
                {availableTeams
                  .filter(
                    (t) =>
                      t.id !==
                        projects.find((p) => p.id === selectedProject)?.team.id &&
                      t.id !== selectedTeam1
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Group {t.subgroup.name})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleManualAssign}
                disabled={loading || hasProposedChanges}
                className="w-full py-3 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Assign Project'}
              </button>
            </div>
          </div>
          <div className="mt-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Warning:</strong> Manual assignment will fail if either
              team already has 2 projects.
            </p>
          </div>
        </div>
      </div>

      {/* Reassignment Modal */}
      {isReassignModalOpen && projectToReassign && (
        <div className="fixed inset-0 bg-gray-100 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border-2 border-gray-300">
            <div className="px-6 py-5 border-b-2 border-gray-300">
              <h2 className="text-xl font-bold text-gray-800">
                Reassign Project
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Project:{' '}
                <span className="font-medium text-red-800">
                  {projectToReassign.title}
                </span>
              </p>
              <p className="text-gray-600 text-sm">
                Owned by:{' '}
                <span className="font-medium">
                  {projectToReassign.team.name}
                </span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> You are replacing the existing
                  assignments. The new teams you select must not already have 2
                  projects.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-medium text-sm">
                  Assign To Team 1
                </label>
                <select
                  value={reassignTeam1}
                  onChange={(e) => setReassignTeam1(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800"
                >
                  <option value="">Select testing team 1...</option>
                  <option value="NONE">-- Clear Assignment --</option>
                  {availableTeams
                    .filter((t) => t.id !== projectToReassign.team.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Group {t.subgroup.name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-medium text-sm">
                  Assign To Team 2
                </label>
                <select
                  value={reassignTeam2}
                  onChange={(e) => setReassignTeam2(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800"
                >
                  <option value="">Select testing team 2...</option>
                  <option value="NONE">-- Clear Assignment --</option>
                  {availableTeams
                    .filter(
                      (t) =>
                        t.id !== projectToReassign.team.id &&
                        (reassignTeam1 === 'NONE'
                          ? true
                          : t.id !== reassignTeam1)
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Group {t.subgroup.name})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-300 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={closeReassignModal}
                disabled={loading}
                className="px-5 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassignment}
                disabled={loading}
                className="px-5 py-2 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {loading ? 'Confirming...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
