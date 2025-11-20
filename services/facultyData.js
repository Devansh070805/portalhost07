// services/facultyData.js

export const FACULTY_DATA = [
  {
    name: "Dr. Tanya Garg",
    email: "tanya.garg@portal.com",
    password: "password123",
    subgroups: ["3C51", "3C55", "3Q13", "3Q14", "3Q21"]
  },
  {
    name: "Sandeep Kaur",
    email: "sandeep.kaur@portal.com",
    password: "password123",
    subgroups: ["3C32", "3C44", "3C25", "3Q11", "3C22", "3C35"]
  },
  {
    name: "Nisha Thakur",
    email: "nisha.thakur@portal.com",
    password: "password123",
    subgroups: ["3C31", "3C53", "3C73"]
  },
  {
    name: "Reaya Grewal",
    email: "reaya.grewal@portal.com",
    password: "password123",
    subgroups: ["3C33", "3C42", "3C54", "3C63", "3C65"]
  },
  {
    name: "Deep",
    email: "deep@portal.com",
    password: "password123",
    subgroups: ["3C45", "3P14", "3Q16", "3C17", "3C18"]
  },
  {
    name: "Raghav B",
    email: "raghav.b@portal.com",
    password: "password123",
    subgroups: ["3C41", "3C43", "3C62", "3C71"]
  },
  {
    name: "Komal Bharti",
    email: "komal.bharti@portal.com",
    password: "password123",
    subgroups: ["3Q12", "3C72", "3P12", "3C34", "3C13"]
  },
  {
    name: "Sukhpal Singh",
    email: "                    ",
    password: "password123",
    subgroups: ["3Q15", "3C24", "3Q26", "3P11", "3C16"]
  },
  // --- MASTER ADMIN ACCOUNT ---
  {
    name: "Master Admin",
    email: "master.admin@portal.com",
    password: "adminPassword123", // Secure this!
    subgroups: ["ALL"] // Special flag for full access
  }
];

/**
 * Helper to get allowed subgroups for a given email.
 * Returns ["ALL"] for master, an array of strings for faculty, or [] if not found.
 */
export function getFacultyAllowedSubgroups(email) {
  const faculty = FACULTY_DATA.find(f => f.email.toLowerCase() === email.toLowerCase());
  return faculty ? faculty.subgroups : [];
}

/**
 * Helper to check if a user is authorized (exists in the list).
 */
export function isAuthorizedFaculty(email) {
  return FACULTY_DATA.some(f => f.email.toLowerCase() === email.toLowerCase());
}