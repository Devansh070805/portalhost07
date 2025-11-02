'use client';

import { Users, Filter, Check, X, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// --- IMPORT YOUR NEW SERVICE FUNCTIONS ---
import { getAllProjectsForFaculty } from '../../../../services/projects'; // Adjust path
import { getAllTeamsForFaculty } from '../../../../services/teams'; // Adjust path
// --- ⭐ IMPORT THE NEW FUNCTION ---
import { 
  replaceProjectAssignments,
  confirmProjectAssignments // <-- This is new
} from '../../../../services/assignments';


// --- INTERFACES TO MATCH FIREBASE DATA ---
interface Project {
  id: string;
  title: string;
  status: string;
  team: {
    id: string | null;
    name: string;
    subgroup: { name: string };
  };
  testAssignments?: {
    assignedTo: { id: string; name: string };
    isProposed?: boolean;
  }[];
}

interface Team {
  id: string;
  name: string;
  subgroup: { name: string };
}


// --- Helper: Get all teams grouped by subgroup ---
const getTeamsBySubgroup = (teams: Team[]) => {
  return teams.reduce(
    (acc, team) => {
      const subgroupName = team.subgroup.name;
      if (!acc[subgroupName]) {
        acc[subgroupName] = [];
      }
      acc[subgroupName].push(team);
      return acc;
    },
    {} as { [key: string]: Team[] }
  );
};

// --- Helper: Shuffle an array (Fisher-Yates) ---
const shuffle = (array: any[]) => {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
};

// --- ⭐ MODIFIED HELPER: Now accepts excludeTeamIds ---
const findAvailableTeam = (
  subgroupNames: string[], // Shuffled list of subgroups to check
  teamsBySubgroup: { [key: string]: Team[] },
  assignmentCounts: { [key: string]: number },
  maxLoad: number, // This will now always be 2
  excludeTeamIds: string[] // List of team IDs to skip
) => {
  for (const subgroupName of subgroupNames) {
    const teamsInSubgroup = teamsBySubgroup[subgroupName];
    if (!teamsInSubgroup || teamsInSubgroup.length === 0) {
      continue;
    }
    const shuffledTeams = shuffle([...teamsInSubgroup]);
    for (const team of shuffledTeams) {
      // Check if team is excluded
      if (excludeTeamIds.includes(team.id)) {
        continue;
      }
      // Check load
      const currentLoad = assignmentCounts[team.id] || 0;
      if (currentLoad < maxLoad) {
        return { team, subgroupName };
      }
    }
  }
  return null;
};

const getTeamLoad = (teamId: string, allProjects: Project[], projectIdToExclude: string | null) => {
  let currentLoad = 0;
  allProjects.forEach(p => {
    
    // --- THIS IS THE NEW LOGIC ---
    // If this project is the one we're reassigning, skip it.
    // Its slots are "free" for the purpose of this calculation.
    if (p.id === projectIdToExclude) {
        return; 
    }
    // --- END NEW LOGIC ---

    p.testAssignments?.forEach(a => {
      if (a.assignedTo.id === teamId && !a.isProposed) {
        currentLoad++;
      }
    });
  });
  return currentLoad;
};

export default function AssignmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTeam1, setSelectedTeam1] = useState<string>('');
  const [selectedTeam2, setSelectedTeam2] = useState<string>('');
  const [hasProposedChanges, setHasProposedChanges] = useState(false);
  const [userName, setUserName] = useState('');

  // --- NEW STATE FOR REASSIGN MODAL ---
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [projectToReassign, setProjectToReassign] = useState<Project | null>(null);
  const [reassignTeam1, setReassignTeam1] = useState<string>('');
  const [reassignTeam2, setReassignTeam2] = useState<string>('');
  // --- END NEW STATE ---

  useEffect(() => {
    const name = localStorage.getItem('userName') || 'Faculty';
    setUserName(name);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setHasProposedChanges(false);
    try {
      const [projectsData, teamsData] = await Promise.all([
        getAllProjectsForFaculty(),
        getAllTeamsForFaculty(),
      ]);
      // @ts-ignore
      setProjects(projectsData);
      // @ts-ignore
      setTeams(teamsData);
    } catch (error) {
      console.error('Error fetching page data: ', error);
    } finally {
      setLoading(false);
    }
  };

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

  /**
   * -----------------------------------------------------------------
   * --- ⭐ MODIFIED: Two-Pass Random Assignment ---
   * -----------------------------------------------------------------
   */
  const handleRandomAssignment = () => {
    const projectsToAssign = projects.filter(
      (p) => !p.testAssignments || p.testAssignments.length === 0
    );
    if (projectsToAssign.length === 0) {
      alert('No unassigned projects to assign.');
      return;
    }

    const teamsBySubgroup = getTeamsBySubgroup(teams);
    const allSubgroupNames = Object.keys(teamsBySubgroup);
    if (allSubgroupNames.length < 3) {
      alert(
        'Warning: At least three subgroups are recommended for optimal assignment. Attempting assignment anyway.'
      );
    }
    
    if (allSubgroupNames.length === 0 || teams.length < 3) {
      alert(
        'Cannot perform random assignment. Not enough teams available.'
      );
      return;
    }

    const assignmentCounts: { [key: string]: number } = {};
    teams.forEach((t) => {
      assignmentCounts[t.id] = 0;
    });

    const updatedProjects = projects.map((p) => ({
      ...p,
      testAssignments: p.testAssignments ? [...p.testAssignments] : undefined,
    }));
    
    let strictAssignedCount = 0;
    let relaxedAssignedCount = 0;
    let failedProjectIds: string[] = [];

    // --- ⭐ PASS 1: "Strict" Assignment ---
    for (const project of shuffle([...projectsToAssign])) {
      const projectToUpdate = updatedProjects.find(p => p.id === project.id)!;
      const excludeIds = [project.team.id!];
      const projectSubgroup = project.team.subgroup.name;

      const availableNames1 = shuffle(
        allSubgroupNames.filter((n) => n !== projectSubgroup)
      );

      if (availableNames1.length === 0) {
        failedProjectIds.push(project.id);
        continue;
      }
      
      const team1Result = findAvailableTeam(
        availableNames1,
        teamsBySubgroup,
        assignmentCounts,
        2,
        excludeIds
      );

      if (!team1Result) {
        failedProjectIds.push(project.id);
        continue;
      }

      const team1 = team1Result.team;
      excludeIds.push(team1.id);

      const availableNames2 = shuffle(
        availableNames1.filter((n) => n !== team1Result.subgroupName)
      );

      if (availableNames2.length === 0) {
        failedProjectIds.push(project.id);
        continue;
      }

      const team2Result = findAvailableTeam(
        availableNames2,
        teamsBySubgroup,
        assignmentCounts,
        2,
        excludeIds
      );

      if (!team2Result) {
        failedProjectIds.push(project.id);
        continue;
      }

      // --- Strict Success! ---
      const team2 = team2Result.team;
      assignmentCounts[team1.id] = (assignmentCounts[team1.id] || 0) + 1;
      assignmentCounts[team2.id] = (assignmentCounts[team2.id] || 0) + 1;
      strictAssignedCount++;
      
      projectToUpdate.testAssignments = [
        { assignedTo: { id: team1.id, name: team1.name }, isProposed: true },
        { assignedTo: { id: team2.id, name: team2.name }, isProposed: true },
      ];
    }
    
    // --- ⭐ PASS 2: "Relaxed" Assignment (The "Final Check") ---
    let finalFailedCount = 0;
    if (failedProjectIds.length > 0) {
       console.warn(`Pass 1 failed for ${failedProjectIds.length} projects. Running relaxed Pass 2.`);
       
       for (const projectId of failedProjectIds) {
         const project = updatedProjects.find(p => p.id === projectId)!;
         const excludeIds = [project.team.id!];

         // Search ALL subgroups
         const allAvailableNames = shuffle([...allSubgroupNames]);

         // Find Team 1 (Relaxed)
         const team1Result = findAvailableTeam(
           allAvailableNames,
           teamsBySubgroup,
           assignmentCounts,
           2,
           excludeIds
         );

         if (!team1Result) {
           finalFailedCount++;
           console.error(`Could not find even one team for ${project.title}`);
           continue;
         }

         const team1 = team1Result.team;
         excludeIds.push(team1.id);

         // Find Team 2 (Relaxed)
         const team2Result = findAvailableTeam(
           allAvailableNames,
           teamsBySubgroup,
           assignmentCounts,
           2,
           excludeIds
         );
         
         if (!team2Result) {
           finalFailedCount++;
           console.error(`Could not find a second team for ${project.title}`);
           continue;
         }

         // --- Relaxed Success! ---
         const team2 = team2Result.team;
         assignmentCounts[team1.id] = (assignmentCounts[team1.id] || 0) + 1;
         assignmentCounts[team2.id] = (assignmentCounts[team2.id] || 0) + 1;
         relaxedAssignedCount++;

         project.testAssignments = [
           { assignedTo: { id: team1.id, name: team1.name }, isProposed: true },
           { assignedTo: { id: team2.id, name: team2.name }, isProposed: true },
         ];
       }
    }

    // 9. Finalization
    setProjects(updatedProjects);
    setHasProposedChanges(true);
    alert(
      `Assignment proposals complete.\n\n` +
      `- ${strictAssignedCount} projects assigned (Strict Rules).\n` +
      `- ${relaxedAssignedCount} projects assigned (Relaxed Rules).\n` +
      `${finalFailedCount > 0 ? `- ${finalFailedCount} projects could not be assigned (no available teams).` : ''}\n\n` +
      `Please review the proposals.`
    );
  };
  // -----------------------------------------------------------------
  // --- End of Modified Implementation ---
  // -----------------------------------------------------------------


  // --- ⭐ FIXED FUNCTION ---
  // This function is now correct. It calls the new service function
  // 'confirmProjectAssignments' to atomically confirm proposals
  // instead of incorrectly trying to add new assignments.
  const handleConfirmAllAssignments = async () => {
    setLoading(true);
    const projectsToConfirm = projects.filter((p) =>
      p.testAssignments?.some((a) => a.isProposed)
    );

    // Create ONE promise per PROJECT, not one per assignment
    const projectPromises = projectsToConfirm.map((p) => {
      // Format the assignments to match what replaceProjectAssignments expects
      const newAssignments = p.testAssignments!.map(a => ({
          teamId: a.assignedTo.id,
          teamName: a.assignedTo.name,
      }));
      
      // Call the *correct* function
      return replaceProjectAssignments(p.id, newAssignments);
    });

    try {
      const results = await Promise.all(projectPromises);
      
      const successCount = results.filter((r) => r.success).length;
      alert(`Successfully confirmed assignments for ${successCount} projects!`);

      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount > 0) {
        alert(`Failed to confirm assignments for ${failedCount} projects. Check console for errors.`);
        results.filter((r) => !r.success).forEach((r) => {
            // @ts-ignore
            console.error(`Failed project ${r.projectId || 'unknown'}: ${r.error}`);
        });
      }

    } catch (error){
      console.error('Error confirming assignments: ', error);
      alert('An error occurred while confirming assignments.');
    } finally {
      fetchData(); // Refresh state from DB
    }
  };

  const handleCancelChanges = () => {
    fetchData();
  };

  // --- ⭐ MODIFIED: Renamed to reflect it's for *Proposed* items ---
  const handleRerollProposedProject = (projectId: string) => {
    const projectToReassign = projects.find((p) => p.id === projectId);
    if (!projectToReassign) return;

    const teamsBySubgroup = getTeamsBySubgroup(teams);
    const allSubgroupNames = Object.keys(teamsBySubgroup);

    // 1. Calculate current proposed load, *excluding this project*
    const assignmentCounts: { [key: string]: number } = {};
    teams.forEach((t) => {
      assignmentCounts[t.id] = 0;
    });
    projects.forEach((p) => {
      if (p.id !== projectId && p.testAssignments?.some((a) => a.isProposed)) {
        p.testAssignments.forEach((a) => {
          if (a.isProposed) {
             assignmentCounts[a.assignedTo.id] =
            (assignmentCounts[a.assignedTo.id] || 0) + 1;
          }
        });
      }
    });

    // 2. Now, find two new teams for *this* project
    const excludeIds = [projectToReassign.team.id!];
    let team1: Team | null = null;
    let team2: Team | null = null;

    // --- Pass 1: "Strict" Re-roll ---
    const projectSubgroup = projectToReassign.team.subgroup.name;
    const availableNames1 = shuffle(
      allSubgroupNames.filter((n) => n !== projectSubgroup)
    );
    
    const team1ResultStrict = findAvailableTeam(
      availableNames1, teamsBySubgroup, assignmentCounts, 2, excludeIds
    );

    if (team1ResultStrict) {
      const team1Strict = team1ResultStrict.team;
      const availableNames2 = shuffle(
        availableNames1.filter((n) => n !== team1ResultStrict.subgroupName)
      );
      const team2ResultStrict = findAvailableTeam(
        availableNames2, teamsBySubgroup, assignmentCounts, 2, [...excludeIds, team1Strict.id]
      );
      if (team2ResultStrict) {
        team1 = team1Strict;
        team2 = team2ResultStrict.team;
      }
    }
    
    // --- Pass 2: "Relaxed" Re-roll (if strict failed) ---
    if (!team1 || !team2) {
      console.warn("Strict re-roll failed, trying relaxed re-roll.");
      const allAvailableNames = shuffle([...allSubgroupNames]);
      
      const team1ResultRelaxed = findAvailableTeam(
        allAvailableNames, teamsBySubgroup, assignmentCounts, 2, excludeIds
      );

      if (!team1ResultRelaxed) {
         alert('Could not find even one available team to reassign.');
         return;
      }

      const relaxedTeam1 = team1ResultRelaxed.team;
      
      const team2ResultRelaxed = findAvailableTeam(
        allAvailableNames, teamsBySubgroup, assignmentCounts, 2, [...excludeIds, relaxedTeam1.id]
      );

      if (!team2ResultRelaxed) {
        alert('Found one team, but could not find a second available team.');
        return;
      }
      team1 = relaxedTeam1;
      team2 = relaxedTeam1; // <-- Bug was here, fixed to team2ResultRelaxed.team
    }

    // Success!
    setProjects(
      projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              testAssignments: [
                {
                  assignedTo: { id: team1!.id, name: team1!.name },
                  isProposed: true,
                },
                {
                  assignedTo: { id: team2!.id, name: team2!.name },
                  isProposed: true,
                },
              ],
            }
          : p
      )
    );
  };
  
  const handleAutoAssign = () => {
    alert(
      'Auto-assignment is a complex backend task and is not implemented in this demo.'
    );
  };

  // --- ⭐ FIXED FUNCTION ---
  // This function is now hardened to prevent crashes. It safely
  // checks for team names before trying to use them.
  const handleManualAssign = async () => {
    if (!selectedProject || !selectedTeam1 || !selectedTeam2) {
      alert('Please select a project and two different teams.');
      return;
    }

    if (selectedTeam1 === selectedTeam2) {
      alert('Please select two *different* teams.');
      return;
    }
    
    const project = projects.find((p) => p.id === selectedProject);
    if (!project) {
      alert('Project not found.');
      return;
    }

    if (project.team.id === selectedTeam1 || project.team.id === selectedTeam2) {
       alert('A team cannot test its own project.');
       return;
    }

    // --- SAFE CHECKS (FIX 1) ---
    // Safely get team names to prevent crash
    const team1Name = teams.find(t => t.id === selectedTeam1)?.name;
    const team2Name = teams.find(t => t.id === selectedTeam2)?.name;

    if (!team1Name || !team2Name) {
      alert('Error: Could not find the selected team names. Please refresh.');
      return;
    }
    // --- END SAFE CHECKS ---


    // Check load for Team 1
    const load1 = getTeamLoad(selectedTeam1, projects,null);
    if (load1 >= 2) {
      alert(`Assignment failed: Team 1 (${team1Name}) is already at its 2-project limit.`);
      return;
    }

    // Check load for Team 2
    const load2 = getTeamLoad(selectedTeam2, projects,null);
    if (load2 >= 2) {
      alert(`Assignment failed: Team 2 (${team2Name}) is already at its 2-project limit.`);
      return;
    }
    
    setLoading(true);
    try {
      // --- (FIX 2) ---
      // Use the safe team names
      const newAssignments = [
        { teamId: selectedTeam1, teamName: team1Name },
        { teamId: selectedTeam2, teamName: team2Name },
      ];

      // @ts-ignore
      // Call the correct service function
      const result = await replaceProjectAssignments(
        selectedProject,
        newAssignments
      );

      // @ts-ignore
      if (result.success) {
        alert('Project assigned to both teams successfully!');
        fetchData(); 
        setSelectedProject('');
        setSelectedTeam1('');
        setSelectedTeam2('');
      } else {
        // @ts-ignore
        alert(`Assignment failed: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during assignment.');
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Functions to control the reassign modal ---
  const openReassignModal = (project: Project) => {
    if (hasProposedChanges) {
      alert("Please confirm or cancel pending changes before reassigning.");
      return;
    }
    setProjectToReassign(project);
    // Pre-fill modal with current assignments
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

  // --- ⭐ FIXED FUNCTION ---

  const handleConfirmReassignment = async () => {
    if (!projectToReassign) return;

    // 1. Check for duplicates (and ignore "NONE" or empty strings)
    if (reassignTeam1 && reassignTeam1 !== "NONE" && reassignTeam1 === reassignTeam2) {
        alert('You cannot assign the same team twice.');
        return;
    }

    // 2. Check for self-assignment
    if (reassignTeam1 === projectToReassign.team.id || reassignTeam2 === projectToReassign.team.id) {
        alert('A team cannot test its own project.');
        return;
    }

    setLoading(true);
    const newAssignments = [];
    
    try {
      // 3. Process Team 1
      if (reassignTeam1 && reassignTeam1 !== "NONE") {
          const team1Name = teams.find(t => t.id === reassignTeam1)?.name;
          if (!team1Name) {
              throw new Error('Error: Could not find the name for Team 1.');
          }
          // Check load
          const load1 = getTeamLoad(reassignTeam1, projects,projectToReassign.id);
          if (load1 >= 2) {
              throw new Error(`Assignment failed: Team 1 (${team1Name}) is already at its 2-project limit.`);
          }
          newAssignments.push({ teamId: reassignTeam1, teamName: team1Name });
      }

      // 4. Process Team 2
      if (reassignTeam2 && reassignTeam2 !== "NONE") {
          const team2Name = teams.find(t => t.id === reassignTeam2)?.name;
          if (!team2Name) {
              throw new Error('Error: Could not find the name for Team 2.');
          }
          // Check load
          const load2 = getTeamLoad(reassignTeam2, projects,projectToReassign.id);
          if (load2 >= 2) {
              throw new Error(`Assignment failed: Team 2 (${team2Name}) is already at its 2-project limit.`);
          }
          newAssignments.push({ teamId: reassignTeam2, teamName: team2Name });
      }

      // 5. Confirm the action with the user
      let confirmMessage = "";
      if (newAssignments.length === 0) {
          confirmMessage = "Are you sure you want to clear all assignments? This will make the project 'Unassigned'.";
      } else if (newAssignments.length === 1) {
          confirmMessage = `Are you sure you want to assign this project to only one team (${newAssignments[0].teamName})?`;
      } else {
          confirmMessage = `Are you sure you want to assign this project to ${newAssignments[0].teamName} and ${newAssignments[1].teamName}?`;
      }

      if (!confirm(confirmMessage)) {
          setLoading(false);
          return;
      }
      
      // 6. Call the replaceProjectAssignments function
      const result = await replaceProjectAssignments(
          projectToReassign.id,
          newAssignments // This array can now have 0, 1, or 2 teams
      );

      // @ts-ignore
      if (result.success) {
          alert('Project reassigned successfully!');
          closeReassignModal();
          fetchData();
      } else {
          // @ts-ignore
          throw new Error(result.error);
      }
    } catch (error: any) {
        console.error('Error during reassignment: ', error);
        alert(`Reassignment failed: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };


  const unassignedProjectsList = projects.filter(
    (p) => !p.testAssignments || p.testAssignments.length === 0
  );
  const availableTeams = teams;

  if (loading) {
     return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    {/* ... (loading spinner UI) ... */}
                    <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div> <p className="mt-4 text-gray-600">Loading Assignments...</p> </div>
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

  {/* Full-width button */}
  <button
    onClick={handleRandomAssignment}
    disabled={loading || hasProposedChanges}
    className="w-full py-4 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
  >
    <Users className="w-5 h-5" />
    Propose Random Assignments
  </button>

  {/* Info note below */}
  <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
    <p className="text-blue-800 text-sm">
      <strong>Note:</strong> Random assignment prioritizes different subgroups,
      but will assign teams from any subgroup if required (as a "final check").
      The <strong>max 2 projects</strong> rule is always enforced.
    </p>
  </div>
</div>

        
        {/* Confirmation Bar */}
        {hasProposedChanges && (
          <div className="bg-white border-2 border-blue-400 rounded-xl p-6 shadow-lg mb-6 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-blue-800">Review Proposals</h3>
              <p className="text-gray-700 mt-1">
                You have {proposedProjects} unconfirmed assignment(s). Review them below, then confirm or cancel.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleConfirmAllAssignments}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                {loading ? "Confirming..." : "Confirm All"}
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
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Project</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Team</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Subgroup</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Assigned To</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Status</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className={`border-b border-gray-300 ${
                      project.testAssignments &&
                      project.testAssignments.length > 0 &&
                      project.testAssignments[0].isProposed
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
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
                      {project.testAssignments &&
                      project.testAssignments.length > 0
                        ? project.testAssignments
                            .map((a) => a.assignedTo.name)
                            .join(', ')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          project.testAssignments &&
                          project.testAssignments.length > 0 &&
                          project.testAssignments[0].isProposed
                            ? 'bg-blue-100 text-blue-700'
                            : project.testAssignments &&
                              project.testAssignments.length > 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {project.testAssignments &&
                        project.testAssignments.length > 0 &&
                        project.testAssignments[0].isProposed
                          ? 'Proposed'
                          : project.testAssignments &&
                            project.testAssignments.length > 0
                          ? 'Assigned'
                          : 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {/* --- MODIFIED ACTIONS --- */}
                      {project.testAssignments &&
                      project.testAssignments.length > 0 &&
                      project.testAssignments[0].isProposed ? (
                        <button 
                          onClick={() => handleRerollProposedProject(project.id)}
                          className="px-4 py-2 bg-white border-2 border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Change
                        </button>
                      ) : project.testAssignments &&
                        project.testAssignments.length > 0 ? (
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
                      {/* --- END MODIFIED ACTIONS --- */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- MODIFIED: Manual Assignment Section --- */}
        <div className="mt-6 bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Manual Assignment (for Unassigned Projects)
          </h2>
          {hasProposedChanges && (
            <div className="mb-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Please confirm or cancel your pending proposals before making a new manual assignment.
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
                disabled={hasProposedChanges || !selectedProject || !selectedTeam1}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 disabled:opacity-50"
              >
                <option value="">Select testing team 2...</option>
                {availableTeams
                  .filter(
                    (t) =>
                      t.id !==
                        projects.find((p) => p.id === selectedProject)?.team.id &&
                      t.id !== selectedTeam1 // <-- Filters out team 1
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
              <strong>Warning:</strong> Manual assignment will add **two** testing teams and will fail if either team is already at its 2-project limit.
            </p>
          </div>
        </div>
      </div>

      {/* --- NEW: Reassignment Modal --- */}
      {isReassignModalOpen && projectToReassign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border-2 border-gray-300">
            <div className="px-6 py-5 border-b-2 border-gray-300">
              <h2 className="text-xl font-bold text-gray-800">Reassign Project</h2>
              <p className="text-gray-600 text-sm mt-1">
                Project: <span className="font-medium text-red-800">{projectToReassign.title}</span>
              </p>
              <p className="text-gray-600 text-sm">
                Owned by: <span className="font-medium">{projectToReassign.team.name}</span>
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> You are replacing the existing assignments. The new teams you select must not have 2 projects already.
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
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 disabled:opacity-50"
                >
                  <option value="">Select testing team 2...</option>
                  <option value="NONE">-- Clear Assignment --</option>
                  {availableTeams
                    .filter(
                      (t) =>
                        t.id !== projectToReassign.team.id &&
                        (reassignTeam1 === "NONE" ? true : t.id !== reassignTeam1)
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
      {/* --- END REASSIGNMENT MODAL --- */}
    </div>
  );
}